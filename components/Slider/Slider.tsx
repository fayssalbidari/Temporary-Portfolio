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

export default function Slider({ projects }: { projects: SliderProject[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
      measure();
    }

    const s = scroll.current;
    const state = { appear: 1, spread: 1, shear: 0, bend: 0 };
    let raf = 0;
    let last = performance.now();
    let timeline: gsap.core.Timeline | null = null;
    let cancelled = false;

    const bendFor = () => (reduced ? 0 : clamp(window.innerHeight * 0.055, 18, 70));

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
      state.bend = state.bend === 0 ? 0 : bendFor();
      measure();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const ease = 1 - Math.pow(1 - (s.dragging ? 0.35 : 0.085), dt * 60);
      const previous = s.current;
      s.current += (s.target - s.current) * ease;
      if (Math.abs(s.target - s.current) < 0.05) s.current = s.target;
      track.style.transform = `translate3d(${s.current}px,0,0)`;

      const velocity = (s.current - previous) / Math.max(dt, 0.001);
      const targetShear = reduced ? 0 : clamp(velocity / 9000, -0.22, 0.22);
      state.shear += (targetShear - state.shear) * 0.12;

      gl?.render(state);
      raf = requestAnimationFrame(tick);
    };

    const finishIntro = () => {
      introPlayed = true;
      root.dataset.intro = "done";
      html.dataset.intro = "done";
    };

    if (gl) {
      root.dataset.mode = "gl";
      measure();
      state.bend = bendFor();

      const skipIntro = reduced || introPlayed;
      if (skipIntro) {
        finishIntro();
      } else {
        root.dataset.intro = "running";
        state.appear = 0;
        state.spread = 0;

        // On attend les images (2,5 s maximum) pour que l'intro ne démarre pas à vide.
        const images = strips.map((el) => el.querySelector("img") as HTMLImageElement);
        const loaded = Promise.all(images.map((img) => img.decode().catch(() => undefined)));
        const timeout = new Promise((resolve) => window.setTimeout(resolve, 2500));
        Promise.race([loaded, timeout]).then(() => {
          if (cancelled) return;
          timeline = gsap
            .timeline({ onComplete: finishIntro })
            .to(state, { appear: 1, duration: 1.1, ease: "power3.out" })
            .to(state, { spread: 1, duration: 2, ease: "none" }, "+=0.35")
            .call(() => {
              html.dataset.intro = "done";
            }, [], "-=0.7");
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
  );
}
