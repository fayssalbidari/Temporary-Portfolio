"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import DotLink from "@/components/DotLink/DotLink";
import { SliderGL } from "./webgl";
import type { SliderProject } from "./types";
import styles from "./Slider.module.css";

// Dimensions du Figma (en px à 1440 px de large) : doivent rester alignées avec Slider.module.css.
gsap.registerPlugin(SplitText);

const STRIP = 66;
const STRIP_GAP = 10;
const STRIP_OPEN = 473;
const INFO = 233 + 10;
const GROUP_GAP = 248;
// Vitesse du défilement automatique (px à 1440 px de large, par seconde).
const AUTO_SPEED = 42;

// Vrai tant que la page n'a pas été rechargée : l'intro ne se rejoue pas en revenant sur la Home.
let introPlayed = false;

const openEase = gsap.parseEase("power4.inOut");

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function getUnit(viewportWidth: number) {
  return viewportWidth <= 900 ? Math.min(viewportWidth / 393, 1.2) : Math.min(viewportWidth / 1440, 1.35);
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
  let widest = 0;
  let x = pad;
  projects.forEach((project, index) => {
    starts.push(x);
    const opened = openProject === index;
    // Mobile : l'image ouverte prend la largeur de l'écran et le texte passe dessous.
    const mobile = viewportWidth <= 900;
    const openWidth = mobile ? viewportWidth - 2 * pad : STRIP_OPEN * u;
    const infoWidth = mobile ? 0 : INFO * u;
    const width =
      project.images.length * (STRIP + STRIP_GAP) * u +
      (opened ? openWidth - STRIP * u + infoWidth : 0);
    widest = Math.max(widest, width);
    x += width + GROUP_GAP * u;
  });
  const total = x + pad;
  return { starts, loop: x - pad, widest, max: Math.max(0, total - viewportWidth) };
}

// Segment de texte du loader. Il est découpé en caractères avec le plugin SplitText de GSAP.
// Les segments « crop » disparaissent au step 2 pour ne laisser que « FB ».
function Segment({ text, crop = false }: { text: string; crop?: boolean }) {
  return crop ? (
    <span className={styles.crop} data-crop>
      <span data-split>{text}</span>
    </span>
  ) : (
    <span className={styles.segment} data-split>
      {text}
    </span>
  );
}

// Longueur réelle de la boucle, lue dans la mise en page actuelle (elle change pendant
// l'ouverture et la fermeture d'un projet).
function getLiveLoop(groups: ArrayLike<HTMLElement>) {
  if (groups.length === 0) return 0;
  const first = groups[0];
  const last = groups[groups.length - 1];
  const gap = parseFloat(getComputedStyle(last).marginRight) || 0;
  return last.offsetLeft + last.offsetWidth + gap - first.offsetLeft;
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
  const pulseRef = useRef<((id: string, sign: number, close?: boolean) => void) | null>(null);
  const scroll = useRef({
    target: 0,
    current: 0,
    max: 0,
    loop: 0,
    infinite: false,
    lastInput: 0,
    openedAt: 0,
    scrollClosedAt: -1e9,
    anim: null as null | { from: number; to: number; start: number; duration: number },
    moved: 0,
    dragging: false,
  });

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
    const s = scroll.current;
    s.max = metrics.max;
    s.loop = metrics.loop;
    // Slider infini : dès que la boucle est nettement plus large que l'écran.
    s.infinite = metrics.loop - metrics.widest - 40 > window.innerWidth;
    if (!s.infinite) s.target = clamp(s.target, -metrics.max, 0);
    return { ...metrics, pad };
  }, [projects]);

  // Ouverture / fermeture : on amène le projet ouvert au bord gauche de l'écran, par le
  // chemin le plus court (la boucle est infinie : le projet peut être de chaque côté).
  useEffect(() => {
    openRef.current = openId;
    const metrics = measure();
    const index = openProjectIndex(openId);
    if (metrics && index !== null) {
      const s = scroll.current;
      s.lastInput = performance.now();
      s.openedAt = performance.now();
      // Position de défilement qui amène le projet au bord gauche, calculée sur la mise en page
      // finale (pas sur l'état en cours d'animation : un projet voisin peut encore être en
      // train de se refermer).
      // Mobile : c'est l'image ouverte (et non le début du projet) qui se place au bord gauche.
      const imageIndex = openId ? Number(openId.split(":")[1]) : 0;
      const before =
        window.innerWidth <= 900
          ? imageIndex * (STRIP + STRIP_GAP) * getUnit(window.innerWidth)
          : 0;
      const base = metrics.pad - metrics.starts[index] - before;
      let to = clamp(base, -metrics.max, 0);
      if (s.infinite) {
        // Boucle infinie : on garde la copie du projet qui est réellement à l'écran, puis on
        // décale le défilement d'un nombre entier de tours (invisible) pour que l'animation
        // aille vers la position de base, sans dépendre de la longueur de la boucle.
        const groups = trackRef.current?.querySelectorAll<HTMLElement>("[data-group]");
        const group = groups?.[index];
        const loopNow = groups ? getLiveLoop(groups) : 0;
        if (group && loopNow > 0) {
          const live = s.current + metrics.pad - group.getBoundingClientRect().left;
          const turns = Math.round((live - base) / loopNow) * loopNow;
          s.current -= turns;
        }
        to = base;
      }
      // Le déplacement est une animation à part (même durée que l'ouverture de la bande) : on
      // coupe l'élan du scroll en cours pour partir de la position actuelle, sans à-coup.
      s.target = s.current;
      s.anim = { from: s.current, to, start: performance.now(), duration: 900 };
    }
  }, [openId, measure]);

  // Texte du projet : il apparaît avec SplitText (lignes montant derrière leur masque) à
  // l'ouverture, et repart plus vite à la fermeture.
  const infoRef = useRef(
    new Map<number, { splits: SplitText[]; link: Element | null; tweens: gsap.core.Tween[] }>(),
  );
  const shownInfo = useRef<number | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const index = openProjectIndex(openId);
    const previous = shownInfo.current;
    if (index === previous) return;
    shownInfo.current = index;

    const groups = track.querySelectorAll<HTMLElement>("[data-group]");
    const entries = infoRef.current;

    // Fermeture (ou passage à un autre projet) : le texte repart vite, ligne après ligne.
    if (previous !== null) {
      const entry = entries.get(previous);
      if (entry) {
        entry.tweens.forEach((tween) => tween.kill());
        const lines = entry.splits.flatMap((split) => split.lines);
        entry.tweens = [
          gsap.to(lines, {
            yPercent: 115,
            duration: reduced ? 0 : 0.5,
            ease: "power2.inOut",
            stagger: 0.035,
          }),
        ];
        if (entry.link) {
          entry.tweens.push(
            gsap.to(entry.link, { opacity: 0, duration: reduced ? 0 : 0.35, ease: "power1.inOut" }),
          );
        }
      }
    }

    // Ouverture : le texte apparaît avec un split-text, après le début de l'ouverture de la bande.
    if (index !== null) {
      const group = groups[index];
      if (!group) return;
      const old = entries.get(index);
      if (old) {
        old.tweens.forEach((tween) => tween.kill());
        old.splits.forEach((split) => split.revert());
      }
      const texts = Array.from(group.querySelectorAll<HTMLElement>("[data-info-text]"));
      const link = group.querySelector("[data-info-link]");
      const splits = texts.map((el) =>
        SplitText.create(el, { type: "lines", mask: "lines", aria: "auto" }),
      );
      const lines = splits.flatMap((split) => split.lines);
      const tweens: gsap.core.Tween[] = [];
      if (reduced) {
        gsap.set(lines, { yPercent: 0 });
        if (link) gsap.set(link, { opacity: 1 });
      } else {
        gsap.set(lines, { yPercent: 115 });
        tweens.push(
          gsap.to(lines, {
            yPercent: 0,
            duration: 1,
            ease: "expo.out",
            stagger: 0.07,
            delay: 0.4,
          }),
        );
        if (link) {
          gsap.set(link, { opacity: 0, yPercent: 40 });
          tweens.push(
            gsap.to(link, {
              opacity: 1,
              yPercent: 0,
              duration: 0.9,
              ease: "expo.out",
              delay: 0.7,
            }),
          );
        }
      }
      entries.set(index, { splits, link, tweens });
    }
  }, [openId]);

  useEffect(() => {
    const entries = infoRef.current;
    return () => {
      entries.forEach((entry) => {
        entry.tweens.forEach((tween) => tween.kill());
        entry.splits.forEach((split) => split.revert());
      });
      entries.clear();
    };
  }, []);

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

    pulseRef.current = (id, sign, close = false) => {
      const [projectIndex, imageIndex] = id.split(":").map(Number);
      gl?.pulse(projectIndex, imageIndex, sign, close);
    };
    const s = scroll.current;
    const limit = (value: number) => (s.infinite ? value : clamp(value, -s.max, 0));
    // Le slider reste droit, comme dans le Figma : pas de courbure ni d'inclinaison.
    const state = { appear: 1, spread: 1, expand: 1, spin: 1, fly: 1, unit: getUnit(window.innerWidth), shear: 0, bend: 0, dt: 0, hoverEnabled: false };
    let raf = 0;
    let last = performance.now();
    let drift = 0;
    let anchor: HTMLElement | null = null;
    let anchorX: number | null = null;
    let anchorCurrent = 0;
    let timeline: gsap.core.Timeline | null = null;
    let cancelled = false;
    let splitInstances: SplitText[] = [];

    const onWheel = (event: WheelEvent) => {
      if (root.dataset.intro !== "done") {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      // Scroller dans le slider referme le projet ouvert (pas juste après l'ouverture, pour ne
      // pas confondre avec l'inertie d'un scroll précédent).
      if (s.anim) {
        // Pendant le déplacement d'ouverture, on ignore la molette (sauf après 0,5 s : c'est
        // alors un vrai scroll, qui referme le projet).
        if (performance.now() - s.openedAt <= 500) return;
        s.anim = null;
      }
      if (openRef.current && performance.now() - s.openedAt > 500) {
        s.scrollClosedAt = performance.now();
        setOpenId(null);
      }
      const unit = event.deltaMode === 1 ? 16 : 1;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      s.target = limit(s.target - delta * unit);
      s.lastInput = performance.now();
    };

    let pointerId: number | null = null;
    let startX = 0;
    let lastX = 0;
    let dragVelocity = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (root.dataset.intro !== "done" || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      s.lastInput = performance.now();
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
        s.anim = null;
        if (openRef.current) {
          s.scrollClosedAt = performance.now();
          setOpenId(null);
        }
      }
      if (s.dragging) {
        s.target = limit(s.target + dx);
        dragVelocity = dx;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      pointerId = null;
      if (s.dragging) {
        // Un peu d'élan au relâchement.
        s.target = limit(s.target + dragVelocity * 9);
      }
      s.dragging = false;
      s.lastInput = performance.now();
      delete root.dataset.dragging;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (root.dataset.intro !== "done") return;
      s.lastInput = performance.now();
      const step = window.innerWidth * 0.35;
      if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && openRef.current) {
        s.anim = null;
        s.scrollClosedAt = performance.now();
        setOpenId(null);
      }
      if (event.key === "ArrowRight") s.target = limit(s.target - step);
      else if (event.key === "ArrowLeft") s.target = limit(s.target + step);
      else if (event.key === "Escape") setOpenId(null);
    };

    // Mobile : distance entre le haut du texte du hero et le haut du slider. Le texte d'un projet
    // ouvert prend cette place (voir Slider.module.css).
    const updateHeroOffset = () => {
      const heroTitle = document.querySelector("[data-hero-content] h1");
      if (!heroTitle) return;
      const offset = root.getBoundingClientRect().top - heroTitle.getBoundingClientRect().top;
      root.style.setProperty("--hero-offset", `${Math.max(0, offset)}px`);
    };
    updateHeroOffset();
    document.fonts.ready.then(updateHeroOffset);

    const onResize = () => {
      gl?.resize(window.innerWidth, window.innerHeight);
      state.unit = getUnit(window.innerWidth);
      updateHeroOffset();
      measure();
    };

    // Slider infini : chaque projet est replacé d'un tour de boucle dès qu'il est complètement
    // sorti de l'écran, pour réapparaître de l'autre côté.
    const groups = Array.from(track.querySelectorAll<HTMLElement>("[data-group]"));
    // Décalage « retardé » des projets : quand un projet se referme, ceux qui le suivent
    // glissent vers la gauche avec de l'inertie (comme un scroll qui ralentit) au lieu de
    // suivre la mise en page d'un bloc. Vers la droite (ouverture), pas de retard.
    const smoothLeft: number[] = [];
    const wrapGroups = (lagK: number | null = null) => {
      // La boucle est lue dans la mise en page actuelle, pas dans sa valeur finale : sinon
      // les projets sauteraient pendant qu'un projet s'ouvre ou se ferme.
      const loop = getLiveLoop(groups);
      if (loop <= 0) return;
      s.loop = loop;
      // On garde le défilement dans (-boucle, 0] : décaler d'un tour entier ne change rien à
      // l'affichage, et les projets restent toujours sur la même « copie » de la boucle.
      if (!s.anim) {
        const turns = Math.ceil(s.current / loop) * loop;
        if (turns !== 0) {
          s.current -= turns;
          s.target -= turns;
          anchorCurrent -= turns;
        }
      }
      // La piste est replacée ici, après le décalage d'un tour : sinon, pendant une image, la
      // piste et les projets ne seraient pas d'accord et le slider disparaîtrait.
      track.style.transform = `translate3d(${s.current}px,0,0)`;
      groups.forEach((group, i) => {
        const width = group.offsetWidth;
        const left = group.offsetLeft;
        const x = left + s.current;
        const min = -width - 40;
        const wrapped = ((((x - min) % loop) + loop) % loop) + min;

        let smooth = smoothLeft[i];
        if (lagK === null || smooth === undefined || left >= smooth) smooth = left;
        else smooth += (left - smooth) * lagK;
        if (Math.abs(smooth - left) < 0.3) smooth = left;
        smoothLeft[i] = smooth;

        group.style.transform = `translate3d(${wrapped - x + (smooth - left)}px,0,0)`;
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Défilement automatique et doux : il se met en pause (en douceur) pendant un glissé,
      // juste après une action de l'utilisateur, ou quand un projet est ouvert.
      const idle = now - s.lastInput > 1200;
      const canDrift =
        s.infinite && !reduced && idle && !s.dragging && !openRef.current &&
        root.dataset.intro === "done" && !document.hidden;
      drift += ((canDrift ? 1 : 0) - drift) * (1 - Math.pow(1 - 0.04, dt * 60));
      if (drift > 0.001) s.target -= AUTO_SPEED * state.unit * drift * dt;

      if (s.anim) {
        // Ouverture : déplacement lissé jusqu'au bord gauche, avec la même courbe que la bande.
        const progress = clamp((now - s.anim.start) / s.anim.duration, 0, 1);
        s.current = s.anim.from + (s.anim.to - s.anim.from) * openEase(progress);
        s.target = s.current;
        if (progress >= 1) s.anim = null;
      } else {
        const ease = 1 - Math.pow(1 - (s.dragging ? 0.35 : 0.085), dt * 60);
        s.current += (s.target - s.current) * ease;
        if (Math.abs(s.target - s.current) < 0.05) s.current = s.target;
      }
      track.style.transform = `translate3d(${s.current}px,0,0)`;
      // Fermeture par le scroll : le slider ne doit pas bouger (ancrage, sans retard). Fermeture
      // par un clic : les projets suivants glissent avec inertie.
      const anchoring = now - s.scrollClosedAt < 1500;
      const lagK = anchoring ? null : 1 - Math.pow(1 - 0.075, dt * 60);
      if (s.infinite) wrapGroups(lagK);

      // Ancrage : quand le projet se referme, tout ce qui le suit se décale vers la gauche. On
      // compense ce décalage dans le défilement pour que le slider ne bouge pas sous les yeux.
      if (s.infinite && !openRef.current && anchoring && groups.length > 0) {
        let nearest: HTMLElement | null = null;
        let best = Infinity;
        const center = window.innerWidth / 2;
        for (const group of groups) {
          const rect = group.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - center);
          if (distance < best) {
            best = distance;
            nearest = group;
          }
        }
        if (nearest) {
          const x = nearest.getBoundingClientRect().left;
          if (anchor === nearest && anchorX !== null) {
            const jump = x - (anchorX + (s.current - anchorCurrent));
            if (Math.abs(jump) > 0.05) {
              s.current -= jump;
              s.target -= jump;
              track.style.transform = `translate3d(${s.current}px,0,0)`;
              wrapGroups(null);
            }
          }
          anchor = nearest;
          anchorX = nearest.getBoundingClientRect().left;
          anchorCurrent = s.current;
        }
      } else {
        anchor = null;
        anchorX = null;
      }

      state.dt = dt;
      state.hoverEnabled = root.dataset.intro === "done" && !s.dragging;
      gl?.render(state);
      raf = requestAnimationFrame(tick);
    };

    const finishIntro = () => {
      // Le « FB » du loader et le logo de la nav ne doivent jamais être visibles en même temps :
      // avec le mode de fusion « difference », leur superposition ne laisserait qu'un contour.
      // On cache le loader et on affiche le logo dans la même image.
      if (loaderTextRef.current) loaderTextRef.current.style.visibility = "hidden";
      if (overlayRef.current) overlayRef.current.style.visibility = "hidden";
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
        state.spread = 0;
        state.spin = 0;
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

          // Découpe en caractères avec SplitText (chaque lettre derrière son masque).
          const splits = Array.from(text.querySelectorAll<HTMLElement>("[data-split]")).map(
            (el) => SplitText.create(el, { type: "chars", mask: "chars", aria: "none" }),
          );
          splitInstances = splits;
          const chars = splits.flatMap((split) => split.chars);
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
            // Rythme calé sur le loader de Madrepunk : environ 3 s au total.
            // Step 1 : le texte monte, les cartes se posent une à une au centre (masque depuis
            // le centre) puis la pile se décale en diagonale.
            .to(chars, { yPercent: 0, duration: 0.7, ease: "power4.out", stagger: 0.016 }, 0)
            .to(state, { appear: 1, duration: 0.8, ease: "none" }, 0.1)
            .to(state, { spread: 1, duration: 0.5, ease: "power2.inOut" }, 0.55)
            // Step 2 : les cartes quittent la pile l'une après l'autre, forment le cercle qui
            // tourne en ralentissant ; le texte se coupe pour ne laisser que « FB ».
            .to(state, { expand: 1, duration: 0.9, ease: "none" }, 0.95)
            .to(state, { spin: 1, duration: 1.6, ease: "power2.out" }, 0.95)
            .to(crops, { width: 0, duration: 0.7, ease: "power4.inOut" }, 1.25)
            .to(line2, { height: 0, duration: 0.6, ease: "power4.inOut" }, 1.25)
            // Vers la Home : les cartes rejoignent le slider, « FB » monte dans la nav,
            // les autres images se construisent et les textes apparaissent.
            .call(() => {
              target = toLogo();
            }, [], 2.1)
            .to(overlay, { opacity: 0, duration: 0.4, ease: "power1.out" }, 2.15)
            .to(state, { fly: 1, duration: 1.3, ease: "none" }, 2.1)
            .to(
              text,
              {
                x: () => target.x,
                y: () => target.y,
                scale: () => target.scale,
                duration: 1.1,
                ease: "power3.inOut",
              },
              2.15,
            )
            // Près de la nav, le « FB » repasse en noir normal (fin du mode « difference ») : même
            // si le logo de la nav est affiché une image avant la fin, les deux ne forment plus
            // un contour.
            .call(() => {
              text.style.mixBlendMode = "normal";
              text.style.color = "#000";
            }, [], 3.05)
            .call(() => {
              html.dataset.intro = "reveal";
            }, [], 2.6);
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
      splitInstances.forEach((split) => split.revert());
      window.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      pulseRef.current = null;
      groups.forEach((group) => group.style.removeProperty("transform"));
      gl?.destroy();
    };
  }, [measure]);

  const onStripClick = (id: string) => {
    // Un glissé ne doit pas ouvrir une bande.
    if (scroll.current.moved > 6) return;
    scroll.current.lastInput = performance.now();
    // Déformation WebGL de la bande qui s'ouvre (et de celle qui se ferme).
    const previous = openRef.current;
    if (previous === id) {
      pulseRef.current?.(id, 1, true);
    } else {
      pulseRef.current?.(id, -1);
      // Dans le même projet la fermeture dure autant que l'ouverture ; sinon elle est rapide.
      if (previous) {
        pulseRef.current?.(previous, 1, previous.split(":")[0] !== id.split(":")[0]);
      }
    }
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
            <Segment text="F" />
            <Segment text="ayssal " crop />
            <Segment text="B" />
            <Segment text="idari" crop />
          </div>
          <div className={styles.loaderLine2} data-line2>
            <Segment text="Portfolio" />
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
      data-open-any={openId !== null}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div ref={trackRef} className={styles.track}>
        {projects.map((project, projectIndex) => {
          const isProjectOpen = openId?.startsWith(`${projectIndex}:`) ?? false;

          return (
            <div
              className={styles.group}
              data-group
              key={project.id}
              style={
                {
                  "--before": isProjectOpen ? Number(openId?.split(":")[1] ?? 0) : 0,
                } as React.CSSProperties
              }
            >
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
                    data-project-open={isProjectOpen}
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
                      <h2 className={`${styles.infoTitle} text-title`} data-info-text>{project.title}</h2>
                      {project.type ? (
                        <p className={`${styles.infoType} text-body`} data-info-text>{project.type}</p>
                      ) : null}
                    </div>
                    {project.description ? (
                      <p className={`${styles.infoText} text-body`} data-info-text>{project.description}</p>
                    ) : null}
                  </div>
                  {project.link ? (
                    <div data-info-link>
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
