"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SliderProject } from "@/components/Slider/types";
import { socials } from "@/lib/site";
import { projectInfo } from "@/lib/projectInfo";
import { aboutCopy } from "@/lib/aboutCopy";
import { DrumGL } from "./engine";
import Scramble from "./Scramble";
import Poster from "./Poster";
import styles from "./Drum.module.css";

// Le site est en français : les types de projet de Sanity sont traduits.
const TYPES: Record<string, string> = {
  "School Project": "Projet d'école",
  "Freelance Project": "Freelance",
  "Alternance Project": "Alternance",
};
const typeOf = (t: string | null) => (t ? (TYPES[t] ?? t) : "");
const pad2 = (v: number) => String(v).padStart(2, "0");

const slugOf = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Cursor = "none" | "open" | "drag" | "close" | "link";
const CURSOR_LABEL: Record<Cursor, string> = { none: "", link: "", open: "Ouvrir", drag: "Glisser", close: "Fermer" };

// Home : le slider des projets est le hero. Le WebGL dessine les titres, les feuilles, la
// peinture et le paysage ; le HTML garde le texte lisible, les liens et la grille.
export default function Drum({
  projects,
  tagline,
  portrait,
}: {
  projects: SliderProject[];
  tagline: string;
  portrait: string | null;
}) {
  // La Home et À propos sont la même scène : l'adresse dit seulement laquelle on regarde.
  const about = usePathname() === "/about";
  const aboutRef = useRef(about);
  aboutRef.current = about;
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const picRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const glRef = useRef<DrumGL | null>(null);
  const pendingOpen = useRef(false);
  const pushed = useRef(false);
  const mounted = useRef(false);
  const [current, setCurrent] = useState(0);
  const [slide, setSlide] = useState(0);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Cursor>("none");
  const [grid, setGrid] = useState(true);
  // Préchargement : « load » tant que l'affiche est là, « out » pendant qu'elle se découpe et
  // part (la Home s'écrit déjà dessous), « done » quand elle a disparu.
  const [boot, setBoot] = useState<"load" | "out" | "done">(about ? "done" : "load");
  const [progress, setProgress] = useState(0);
  const booted = boot !== "load";

  useEffect(() => glRef.current?.setGrid(grid), [grid]);

  // G affiche ou masque la grille, comme un calque de mise en page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) setGrid((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.intro = "done";
    html.dataset.page = "drum";
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    let dark = false;

    // Lien direct vers un projet (?p=casa-lunara) ou arrivée sur À propos : pas de préchargement.
    const fromUrl = new URLSearchParams(location.search).get("p");
    const deep = fromUrl ? projects.findIndex((p) => slugOf(p.title) === fromUrl) : -1;
    const booting = !aboutRef.current && deep < 0;
    if (!booting) setBoot("done");
    let lastProgress = -1;

    const gl = new DrumGL(
      canvas,
      projects.map((p) => ({ title: p.title, type: typeOf(p.type), images: p.images.map((i) => i.src) })),
      {
        onChange: setCurrent,
        onSlide: setSlide,
        onOpen: (isOpen) => {
          setOpen(isOpen);
          root.dataset.open = String(isOpen);
          setCursor(isOpen ? "drag" : "none");
        },
        onMoving: (moving) => {
          root.dataset.moving = String(moving);
          // Un clic pendant la chute ouvre le projet dès qu'il est posé.
          if (!moving && pendingOpen.current) {
            pendingOpen.current = false;
            openProject();
          }
        },
        // L'interface passe en clair sur noir au moment où l'encre couvre l'écran.
        onFrame: (_pos, clock) => {
          const next = clock > 0.42;
          if (next !== dark) {
            dark = next;
            root.dataset.dark = String(next);
          }
        },
        onBoot: (p) => {
          if (p !== lastProgress) {
            lastProgress = p;
            setProgress(p);
          }
        },
      },
      booting,
    );
    glRef.current = gl;
    if (portrait) gl.setPortrait(portrait);
    gl.setAbout(aboutRef.current, true);
    (window as unknown as { __drum: DrumGL }).__drum = gl;

    // Lien direct vers un projet : on arrive dessus, ouvert.
    if (deep >= 0) gl.goTo(deep, true);
    let timer = 0;
    void gl.start().then(() => {
      if (deep >= 0) timer = window.setTimeout(() => gl.open(), 700);
    });

    // Le bouton Retour du navigateur ferme le projet.
    const onPop = () => {
      pushed.current = false;
      if (gl.isOpen) gl.close();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      gl.destroy();
      glRef.current = null;
      delete html.dataset.page;
    };
  }, [projects, portrait]);

  // En quittant À propos, l'interface de la Home attend les titres avant de revenir. L'état est
  // posé pendant le rendu même (pas après) : sinon la première image la montre déjà.
  const [leaving, setLeaving] = useState(false);
  const [prevAbout, setPrevAbout] = useState(about);
  if (prevAbout !== about) {
    setPrevAbout(about);
    setLeaving(prevAbout && !about);
  }
  useEffect(() => {
    glRef.current?.setAbout(about);
  }, [about]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), 1500);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // URL et focus suivent l'ouverture.
  useEffect(() => {
    const project = projects[current];
    if (open) {
      closeRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      if (!pushed.current && project) {
        history.pushState({ drum: true }, "", `?p=${slugOf(project.title)}`);
        pushed.current = true;
      }
    } else if (pushed.current) {
      pushed.current = false;
      history.back();
    } else if (location.search.includes("p=")) {
      history.replaceState(null, "", location.pathname);
    }
    if (!open && mounted.current) picRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Curseur d'architecte : une croix fine qui suit la souris, et un mot quand il y a une action.
  useEffect(() => {
    const el = cursorRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let tx = x;
    let ty = y;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.35;
      y += (ty - y) * 0.35;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      root.dataset.cursor = "on";
      const gl = glRef.current;
      const target = e.target as HTMLElement;
      if (target.closest("a,button:not([data-stage])")) setCursor("link");
      else if (gl?.isOpen) {
        const k = gl.slideAt(e.clientX, e.clientY);
        gl.setHoverSlide(k);
        setCursor(k >= 0 ? "drag" : "close");
      }
      else {
        // Une section qui flotte autour de la feuille s'ouvre aussi.
        const section = gl ? gl.sectionAt(e.clientX, e.clientY) : -1;
        gl?.setHoverSection(section);
        if (section >= 0 || target.closest("[data-stage]")) setCursor("open");
        else setCursor("none");
      }
    };
    const onLeave = () => (root.dataset.cursor = "off");
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  function openProject() {
    const gl = glRef.current;
    if (!gl || gl.wasDrag) return;
    if (!gl.open()) pendingOpen.current = true;
  }

  // Au repos : un clic sur une section flottante ouvre le projet depuis elle.
  // Projet ouvert : un clic sur une section voisine la fait venir au centre, un clic sur le fond ferme.
  const onStageClick = (e: React.MouseEvent) => {
    const gl = glRef.current;
    if (!gl || gl.wasDrag) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (!gl.isOpen) {
      const section = gl.sectionAt(e.clientX, e.clientY);
      if (section >= 0) gl.open(section);
      return;
    }
    const j = gl.slideAt(e.clientX, e.clientY);
    if (j >= 0) gl.slideTo(j);
    else gl.close();
  };

  const project = projects[current];
  const linkLabel = project?.linkLabel === "See Project" ? "Visiter le site" : project?.linkLabel;
  const info = project ? projectInfo(project.title) : null;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      aria-label={about ? "À propos" : "Projets"}
      data-open={open}
      data-about={about}
      data-leaving={leaving}
      data-boot={boot}
      onClick={onStageClick}
    >
      {about ? null : <h1 className={styles.srOnly}>Fayssal Bidari, {tagline}</h1>}

      {/* La grille (12 colonnes) est dessinée en WebGL, sous les feuilles. Touche G : la masquer. */}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      {/* En-tête : la marque, le navigateur de projets centré au-dessus de la feuille, les liens. */}
      <header className={styles.head}>
        <Link href="/" className={styles.logo} aria-label="Fayssal Bidari, accueil">
          <i aria-hidden="true" />
          <Scramble text="Fayssal Bidari" delay={250} duration={700} />
        </Link>
        <nav className={styles.pager} aria-label={open ? "Images du projet" : "Projets"} inert={about}>
          <button
            type="button"
            aria-label={open ? "Image précédente" : "Projet précédent"}
            onClick={() => (open ? glRef.current?.slideStep(-1) : glRef.current?.step(-1))}
          >
            ←
          </button>
          <span>
            {open ? pad2(slide + 1) : pad2(current + 1)}
            <em> / {open ? pad2(project?.images.length ?? 0) : pad2(projects.length)}</em>
          </span>
          <button
            type="button"
            aria-label={open ? "Image suivante" : "Projet suivant"}
            onClick={() => (open ? glRef.current?.slideStep(1) : glRef.current?.step(1))}
          >
            →
          </button>
        </nav>
        <nav className={styles.links} aria-label="Navigation principale" inert={open}>
          {about ? (
            <Link href="/">
              <Scramble text="Projets" />
            </Link>
          ) : (
            <Link href="/about">
              <Scramble text="À propos" delay={400} />
            </Link>
          )}
          <a href={socials.email}>
            <Scramble text="Contact" delay={480} />
          </a>
        </nav>
        <button ref={closeRef} type="button" className={styles.close} onClick={() => glRef.current?.close()} inert={!open}>
          Fermer <span>Esc</span>
        </button>
      </header>

      <p className={styles.intro} inert={about}>
        <Scramble text={`${tagline}.`} play={booted} duration={700} />
        <Scramble
          className={styles.introMuted}
          text="Paris — en recherche d'une alternance 2026–27."
          play={booted}
          delay={120}
          duration={700}
        />
      </p>

      {/* La feuille posée au centre : clic = le projet s'ouvre. */}
      <button
        ref={picRef}
        type="button"
        data-stage
        className={styles.pic}
        aria-label={project ? `Ouvrir ${project.title}` : undefined}
        onClick={openProject}
        onPointerEnter={() => glRef.current?.setHover(true)}
        onPointerLeave={() => glRef.current?.setHover(false)}
        inert={open || about}
      />

      {/* Préchargement : l'affiche rouge (la référence EGO), avec les images des projets. */}
      {boot !== "done" ? (
        <Poster
          images={projects.flatMap((p, k) => (k === 0 ? [p.images[0]?.src] : [])).concat(
            projects.slice(1).map((p) => p.images[0]?.src),
            projects.flatMap((p) => p.images.slice(1, 3).map((i) => i.src)),
          ).filter((src): src is string => Boolean(src))}
          count={projects.length}
          progress={progress}
          onRelease={() => {
            glRef.current?.reveal();
            setBoot("out");
          }}
          onDone={() => setBoot("done")}
        />
      ) : null}

      {/* Fiche du projet : ce que c'est (colonnes 1–4), l'action (5–8), les faits (9–12). */}
      <footer className={styles.foot} key={current} inert={about}>
        <div className={styles.about}>
          <h2>
            <Scramble text={project?.title ?? ""} play={booted} duration={480} />
          </h2>
          {open ? (
            <p>{project?.description}</p>
          ) : (
            <Scramble
              className={styles.meta}
              text={info ? `${info.year} — ${info.context}` : typeOf(project?.type ?? null)}
              play={booted}
              delay={60}
            />
          )}
        </div>
        <div className={styles.action}>
          {open ? (
            project?.link ? (
              <a href={project.link} target="_blank" rel="noreferrer" className={styles.button}>
                {linkLabel}
                <span aria-hidden="true">↗</span>
              </a>
            ) : null
          ) : (
            <button type="button" className={styles.button} onClick={openProject}>
              Ouvrir le projet
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
        {info ? (
          <dl className={styles.spec}>
            <div>
              <dt>Rôle</dt>
              <dd>
                <Scramble text={info.role} play={booted} delay={90} />
              </dd>
            </div>
            <div>
              <dt>Outils</dt>
              <dd>
                <Scramble text={info.tools} play={booted} delay={130} />
              </dd>
            </div>
          </dl>
        ) : null}
      </footer>

      {/* À propos : posé sur la même grille ; la feuille retournée (le portrait) occupe les colonnes 1–4. */}
      <section className={styles.aboutPage} inert={!about} aria-hidden={!about}>
        <h2 className={styles.statement}>
          {aboutCopy.statement.map((line, i) => (
            <span key={line} className={styles.line} style={{ "--i": i } as React.CSSProperties}>
              <span>{line}</span>
            </span>
          ))}
        </h2>
        <p className={styles.lead} style={{ "--i": 3 } as React.CSSProperties}>
          {aboutCopy.lead}
        </p>
        <dl className={styles.facts}>
          {aboutCopy.facts.map((f, i) => (
            <div key={f.label} style={{ "--i": 4 + i } as React.CSSProperties}>
              <dt>{f.label}</dt>
              <dd>
                {f.lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <div className={styles.aboutFoot} style={{ "--i": 7 } as React.CSSProperties}>
          <span className={styles.availability}>{aboutCopy.availability}</span>
          <div className={styles.action}>
            <a href={socials.email} className={styles.button}>
              {aboutCopy.cta}
              <span aria-hidden="true">→</span>
            </a>
          </div>
          <nav className={styles.socials} aria-label="Réseaux">
            <a href={socials.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href={socials.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </nav>
        </div>
      </section>

      <div ref={cursorRef} className={styles.cursor} data-mode={cursor} aria-hidden="true">
        <i />
        <span>{CURSOR_LABEL[cursor]}</span>
      </div>
    </section>
  );
}
