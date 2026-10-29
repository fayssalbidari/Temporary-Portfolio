"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import styles from "./PageTransition.module.css";

gsap.registerPlugin(SplitText);

// Transition de page « curved wipe » : un panneau noir aux bords courbes monte depuis le bas,
// recouvre la page, affiche le nom de la page de destination, puis repart vers le haut en
// révélant la nouvelle page. Les clics sur les liens internes sont interceptés ici : aucun
// lien n'a besoin d'être modifié.

const LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
};

function labelFor(pathname: string) {
  if (LABELS[pathname]) return LABELS[pathname];
  const last = pathname.split("/").filter(Boolean).pop() ?? "Home";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const pathRef = useRef(pathname);
  const busy = useRef(false);
  const waiter = useRef<(() => void) | null>(null);

  // Quand la nouvelle page est affichée, on prévient la transition qui l'attend.
  useEffect(() => {
    pathRef.current = pathname;
    waiter.current?.();
  }, [pathname]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const label = labelRef.current;
    if (!overlay || !panel || !label) return;

    const html = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const waitForPath = (target: string) =>
      new Promise<void>((resolve) => {
        if (pathRef.current === target) return resolve();
        const timeout = window.setTimeout(done, 8000);
        function done() {
          window.clearTimeout(timeout);
          waiter.current = null;
          resolve();
        }
        waiter.current = () => {
          if (pathRef.current === target) done();
        };
      });

    const play = async (target: string) => {
      busy.current = true;
      html.dataset.transition = "running";
      // Hauteur réelle de la zone visible (sur mobile, la barre de Safari change window.innerHeight
      // et les unités vh) : le panneau est dimensionné en pixels à partir d'elle.
      const vh = overlay.getBoundingClientRect().height || window.innerHeight;
      const panelHeight = vh * 1.6;

      label.textContent = labelFor(target);
      const split = SplitText.create(label, { type: "chars", mask: "chars", aria: "none" });
      gsap.set(split.chars, { yPercent: 115 });
      gsap.set(overlay, { autoAlpha: 1, pointerEvents: "auto" });
      gsap.set(panel, { y: vh, height: panelHeight, borderRadius: `50% / ${vh * 0.14}px` });

      // 1. Le panneau monte et recouvre la page ; la navigation démarre pendant ce temps.
      await new Promise<void>((resolve) => {
        gsap
          .timeline({ onComplete: resolve })
          .to(panel, { y: -0.3 * vh, duration: 0.65, ease: "power3.inOut" }, 0)
          .call(() => router.push(target), [], 0.3)
          .to(split.chars, { yPercent: 0, duration: 0.55, ease: "expo.out", stagger: 0.025 }, 0.4);
      });

      // 2. On attend que la nouvelle page soit prête, puis le nom reste un instant.
      await waitForPath(target);
      await new Promise((resolve) => window.setTimeout(resolve, 100));

      // 3. Le nom repart, le panneau sort par le haut et révèle la nouvelle page.
      await new Promise<void>((resolve) => {
        gsap
          .timeline({ onComplete: resolve })
          .to(split.chars, { yPercent: -115, duration: 0.4, ease: "power3.in", stagger: 0.015 }, 0)
          .call(() => window.dispatchEvent(new Event("page:reveal")), [], 0.25)
          .to(panel, { y: -(panelHeight + 0.1 * vh), duration: 0.8, ease: "power3.inOut" }, 0.2);
      });

      split.revert();
      gsap.set(overlay, { autoAlpha: 0, pointerEvents: "none" });
      delete html.dataset.transition;
      busy.current = false;
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (reduced.matches) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Le Studio Sanity garde sa navigation d'origine.
      if (url.pathname.startsWith("/studio") || pathRef.current.startsWith("/studio")) return;

      event.preventDefault();
      event.stopPropagation();
      if (busy.current || url.pathname === pathRef.current) return;
      void play(url.pathname + url.search + url.hash);
    };

    // Phase de capture : on passe avant la navigation de next/link.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return (
    <div ref={overlayRef} className={styles.overlay} aria-hidden="true">
      <div ref={panelRef} className={styles.panel} />
      <div ref={labelRef} className={styles.label} />
    </div>
  );
}
