"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import DotLink from "@/components/DotLink/DotLink";
import { SliderGL } from "./webgl";
import type { SliderProject } from "./types";
import styles from "./Slider.module.css";

// Dimensions du Figma (en px à 1440 px de large) : doivent rester alignées avec Slider.module.css.
const STRIP = 66;
const STRIP_GAP = 10;
const STRIP_OPEN = 473;
const INFO = 233 + 10;
const GROUP_GAP = 248;

// Vrai tant que la page n'a pas été rechargée : l'intro ne se rejoue pas en revenant sur la Home.
let introPlayed = false;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function getUnit(viewportWidth: number) {
  return viewportWidth <= 900 ? viewportWidth / 600 : Math.min(viewportWidth / 1440, 1.35);
}

// Calcule la position de chaque projet dans la piste, ouverture comprise (valeurs finales).
function getMetrics(
  projects: SliderProject[],
  openProject: number | null,
  viewportWidth: number,
  pad: number,
) {
  const u = getUnit(viewportWidth);
  const starts: number[] = [];
  let x = pad;
  projects.forEach((project, index) => {
    starts.push(x);
    const opened = openProject === index;
    const width =
      project.images.length * (STRIP + STRIP_GAP) * u +
      (opened ? (STRIP_OPEN - STRIP + INFO) * u : 0);
    x += width + GROUP_GAP * u;
  });
  const total = x + pad;
  return { starts, max: Math.max(0, total - viewportWidth) };
}

// Texte du loader découpé en caractères (split text). Les segments « crop » disparaissent
// au step 2 pour ne laisser que « FB ».
function Chars({ text, crop = false }: { text: string; crop?: boolean }) {
  const chars = Array.from(text).map((char, index) => (
    <span className={styles.mask} key={index}>
      <span className={styles.char} data-char>
        {char === " " ? "\u00A0" : char}
      </span>
    </span>
  ));
  return crop ? (
    <span className={styles.crop} data-crop>
      {chars}
    </span>
  ) : (
    <>{chars}</>
  );
}

export default function Slider({ projects }: { projects: SliderProject[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const loaderTextRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Le loader n'est affiché qu'à la première visite de la Home.
  const [showLoader, setShowLoader] = useState(() => !introPlayed);

  const openRef = useRef<string | null>(null);
  const scroll = useRef({ target: 0, current: 0, max: 0, moved: 0, dragging: false });

  const openProjectIndex = (id: string | null) => (id ? Number(id.split(":")[0]) : null);

  // Recalcule les limites du scroll (et renvoie les positions des projets).
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const metrics = getMetrics(
      projects,
      openProjectIndex(openRef.current),
      window.innerWidth,
      pad,
    );
    scroll.current.max = metrics.max;
    scroll.current.target = clamp(scroll.current.target, -metrics.max, 0);
    return { ...metrics, pad };
  }, [projects]);

  // Ouverture / fermeture : on place le projet ouvert au bord gauche de l'écran.
  useEffect(() => {
    openRef.current = openId;
    const metrics = measure();
    const index = openProjectIndex(openId);
    if (metrics && index !== null) {
      scroll.current.target = clamp(
        -(metrics.starts[index] - metrics.pad),
        -metrics.max,
        0,
      );
    }
  }, [openId, measure]);

  // Scroll, glisser, clavier et rendu WebGL.
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!root || !track || !canvas) return;

    const html = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strips = Array.from(root.querySelectorAll<HTMLElement>("[data-strip]"));

    let gl: SliderGL | null = null;
    try {
      gl = new SliderGL(
        canvas,
        strips.map((el) => ({
          el,
          img: el.querySelector("img") as HTMLImageElement,
          project: Number(el.dataset.project),
          index: Number(el.dataset.index),
        })),
      );
    } catch {
      gl = null;
    }

    // WebGL indisponible : le slider reste affiché en HTML.
    if (!gl) {
      root.dataset.mode = "dom";
      root.dataset.intro = "done";
      html.dataset.intro = "done";
      introPlayed = true;
      measure();
      window.setTimeout(() => setShowLoader(false), 0);
    }

    const s = scroll.current;
    // Le slider reste droit, comme dans le Figma : pas de courbure ni d'inclinaison.
    const state = { appear: 1, expand: 1, fly: 1, unit: getUnit(window.innerWidth), shear: 0, bend: 0 };
    let raf = 0;
    let last = performance.now();
    let timeline: gsap.core.Timeline | null = null;
    let cancelled = false;

    const onWheel = (event: WheelEvent) => {
      if (root.dataset.intro !== "done") {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : 1;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      s.target = clamp(s.target - delta * unit, -s.max, 0);
    };

    let pointerId: number | null = null;
    let startX = 0;
    let lastX = 0;
    let dragVelocity = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (root.dataset.intro !== "done" || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      dragVelocity = 0;
      s.moved = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      s.moved = Math.max(s.moved, Math.abs(event.clientX - startX));
      if (s.moved > 6) {
        s.dragging = true;
        root.dataset.dragging = "true";
      }
      if (s.dragging) {
        s.target = clamp(s.target + dx, -s.max, 0);
        dragVelocity = dx;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      pointerId = null;
      if (s.dragging) {
        // Un peu d'élan au relâchement.
        s.target = clamp(s.target + dragVelocity * 9, -s.max, 0);
      }
      s.dragging = false;
      delete root.dataset.dragging;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (root.dataset.intro !== "done") return;
      const step = window.innerWidth * 0.35;
      if (event.key === "ArrowRight") s.target = clamp(s.target - step, -s.max, 0);
      else if (event.key === "ArrowLeft") s.target = clamp(s.target + step, -s.max, 0);
      else if (event.key === "Escape") setOpenId(null);
    };

    const onResize = () => {
      gl?.resize(window.innerWidth, window.innerHeight);
      state.unit = getUnit(window.innerWidth);
      measure();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const ease = 1 - Math.pow(1 - (s.dragging ? 0.35 : 0.085), dt * 60);
      s.current += (s.target - s.current) * ease;
      if (Math.abs(s.target - s.current) < 0.05) s.current = s.target;
      track.style.transform = `translate3d(${s.current}px,0,0)`;

      gl?.render(state);
      raf = requestAnimationFrame(tick);
    };

    const finishIntro = () => {
      introPlayed = true;
      root.dataset.intro = "done";
      html.dataset.intro = "done";
      setShowLoader(false);
    };

    if (gl) {
      root.dataset.mode = "gl";
      measure();

      const skipIntro = reduced || introPlayed;
      if (skipIntro) {
        finishIntro();
      } else {
        root.dataset.intro = "running";
        html.dataset.intro = "pending";
        state.appear = 0;
        state.expand = 0;
        state.fly = 0;

        // On attend les images et la police (2,5 s maximum) pour que l'intro ne démarre pas à vide.
        const images = strips.map((el) => el.querySelector("img") as HTMLImageElement);
        const loaded = Promise.all([
          document.fonts.ready,
          ...images.map((img) => img.decode().catch(() => undefined)),
        ]);
        const timeout = new Promise((resolve) => window.setTimeout(resolve, 2500));
        Promise.race([loaded, timeout]).then(() => {
          const text = loaderTextRef.current;
          const overlay = overlayRef.current;
          if (cancelled || !text || !overlay || !gl) {
            if (!cancelled) finishIntro();
            return;
          }

          gl.prepareIntro();

          const chars = text.querySelectorAll("[data-char]");
          const crops = text.querySelectorAll<HTMLElement>("[data-crop]");
          const line1 = text.querySelector("[data-line1]") as HTMLElement;
          const line2 = text.querySelector("[data-line2]") as HTMLElement;

          // État de départ : lettres cachées derrière leur masque, largeur des segments figée.
          gsap.set(chars, { yPercent: 115 });
          gsap.set(crops, { width: (_index, el: HTMLElement) => el.offsetWidth });
          gsap.set(text, { opacity: 1 });

          // « FB » rejoint le logo de la nav en changeant d'échelle.
          const logo = document.querySelector("[data-logo]");
          const toLogo = () => {
            const from = line1.getBoundingClientRect();
            const to = (logo ?? line1).getBoundingClientRect();
            const logoSize = logo ? parseFloat(getComputedStyle(logo).fontSize) : 0;
            const textSize = parseFloat(getComputedStyle(text).fontSize);
            return {
              x: to.left + to.width / 2 - (from.left + from.width / 2),
              y: to.top + to.height / 2 - (from.top + from.height / 2),
              scale: logoSize && textSize ? logoSize / textSize : 1,
            };
          };
          let target = { x: 0, y: 0, scale: 1 };

          timeline = gsap
            .timeline({ onComplete: finishIntro })
            // Step 1 : le texte apparaît lettre par lettre, la pile de cartes se pose.
            .to(chars, { yPercent: 0, duration: 0.9, ease: "power4.out", stagger: 0.03 }, 0.1)
            .to(state, { appear: 1, duration: 0.8, ease: "power2.out" }, 0.35)
            // Step 2 : le texte se coupe pour ne laisser que « FB », la pile s'ouvre en cercle.
            .to(crops, { width: 0, duration: 0.9, ease: "power4.inOut" }, 1.7)
            .to(line2, { height: 0, duration: 0.8, ease: "power4.inOut" }, 1.7)
            .to(state, { expand: 1, duration: 1.4, ease: "none" }, 1.7)
            // Vers la Home : les cartes se rangent dans le slider, « FB » monte dans la nav.
            .call(() => {
              target = toLogo();
            }, [], 3.5)
            .to(overlay, { opacity: 0, duration: 0.5, ease: "power1.out" }, 3.55)
            .to(state, { fly: 1, duration: 1.7, ease: "none" }, 3.5)
            .to(
              text,
              {
                x: () => target.x,
                y: () => target.y,
                scale: () => target.scale,
                duration: 1.5,
                ease: "power3.inOut",
              },
              3.55,
            );
        });
      }

      raf = requestAnimationFrame(tick);
      window.addEventListener("wheel", onWheel, { passive: false });
      root.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", onResize);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timeline?.kill();
      window.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      gl?.destroy();
    };
  }, [measure]);

  const onStripClick = (id: string) => {
    // Un glissé ne doit pas ouvrir une bande.
    if (scroll.current.moved > 6) return;
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <>
    {showLoader ? (
      <>
        <div ref={overlayRef} className={styles.overlay} aria-hidden="true">
          <div className="dot-grid" style={{ position: "absolute", inset: 0 }} />
        </div>
        <div ref={loaderTextRef} className={styles.loaderText} aria-hidden="true">
          <div className={styles.loaderLine} data-line1>
            <Chars text="F" />
            <Chars text="ayssal " crop />
            <Chars text="B" />
            <Chars text="idari" crop />
          </div>
          <div className={styles.loaderLine2} data-line2>
            <Chars text="Portfolio" />
          </div>
        </div>
      </>
    ) : null}
    <section
      ref={rootRef}
      className={styles.root}
      data-mode="pending"
      data-intro="idle"
      aria-label="Projets"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div ref={trackRef} className={styles.track}>
        {projects.map((project, projectIndex) => {
          const isProjectOpen = openId?.startsWith(`${projectIndex}:`) ?? false;

          return (
            <div className={styles.group} key={project.id}>
              {project.images.map((image, imageIndex) => {
                const id = `${projectIndex}:${imageIndex}`;
                const isOpen = openId === id;

                return (
                  <button
                    type="button"
                    key={image.key}
                    className={styles.strip}
                    data-strip
                    data-project={projectIndex}
                    data-index={imageIndex}
                    data-open={isOpen}
                    aria-expanded={isOpen}
                    onClick={() => onStripClick(id)}
                  >
                    {/* <img> volontaire : WebGL lit cette image comme texture. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={image.alt}
                      crossOrigin="anonymous"
                      draggable={false}
                      decoding="async"
                    />
                  </button>
                );
              })}

              <div className={styles.info} data-open={isProjectOpen} inert={!isProjectOpen}>
                <div className={styles.infoInner}>
                  <div className={styles.infoTop}>
                    <div className={styles.infoHead}>
                      <h2 className={`${styles.infoTitle} text-title`}>{project.title}</h2>
                      {project.type ? (
                        <p className={`${styles.infoType} text-body`}>{project.type}</p>
                      ) : null}
                    </div>
                    {project.description ? (
                      <p className={`${styles.infoText} text-body`}>{project.description}</p>
                    ) : null}
                  </div>
                  {project.link ? (
                    <div>
                      <DotLink href={project.link} size="md" className="text-body">
                        {project.linkLabel}
                      </DotLink>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
