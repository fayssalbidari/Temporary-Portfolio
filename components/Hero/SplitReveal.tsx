"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

// Texte découpé en lignes avec le plugin SplitText de GSAP. Chaque ligne monte derrière son
// masque quand la Home apparaît (html[data-intro="reveal"]). Hors loader, le texte est affiché
// tel quel.
export default function SplitReveal({
  as: Tag = "span",
  className,
  delay = 0,
  stagger = 0.09,
  children,
}: {
  as?: "h1" | "p" | "span";
  className?: string;
  delay?: number;
  stagger?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    let tween: gsap.core.Tween | null = null;
    // Le texte attend la fin du loader (intro) ou le dévoilement de la page (transition de page).
    const transition = html.dataset.transition === "running";
    let played = html.dataset.intro !== "pending" && !transition;

    const split = SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      autoSplit: true,
      onSplit: (self) => {
        // Re-découpe (redimensionnement) : on repart de l'état courant.
        if (played) return undefined;
        gsap.set(self.lines, { yPercent: 110 });
        return undefined;
      },
    });

    const play = () => {
      if (played) return;
      played = true;
      tween = gsap.to(split.lines, {
        yPercent: 0,
        duration: 1.1,
        ease: "expo.out",
        stagger,
        delay,
      });
    };

    if (!played) {
      gsap.set(split.lines, { yPercent: 110 });
      el.style.visibility = "visible";
      const observer = new MutationObserver(() => {
        if (html.dataset.intro !== "pending") play();
      });
      observer.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
      window.addEventListener("page:reveal", play);
      // Filet de sécurité : tout s'affiche au bout de 9 s.
      const safety = window.setTimeout(play, 9000);
      return () => {
        window.removeEventListener("page:reveal", play);
        observer.disconnect();
        window.clearTimeout(safety);
        tween?.kill();
        split.revert();
      };
    }

    return () => {
      tween?.kill();
      split.revert();
    };
  }, [delay, stagger]);

  return (
    // @ts-expect-error — balise dynamique (h1, p ou span)
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
