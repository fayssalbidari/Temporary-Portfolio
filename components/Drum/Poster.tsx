"use client";

import { useEffect, useState } from "react";
import Scramble from "./Scramble";
import styles from "./Poster.module.css";

// Le préchargement : l'affiche rouge de la référence (EGO), avec nos images.
// Fond rouge, filets noirs, quatre mots qui descendent en escalier d'une ligne à l'autre, une
// bande verticale plus sombre (les colonnes 5–8, là où la première feuille se posera) et une
// diagonale. Pendant le chargement, les images des projets défilent dans le cadre de la feuille.
// À 100 %, l'image s'arrête sur le premier projet ; l'affiche se découpe le long de ses filets
// et chaque bande part de son côté (comme les deux lignes de titres). L'image reste : c'est la
// feuille de la Home, posée exactement au même endroit.

// Le contenu est factuel, comme une planche de studio : les disciplines, le lieu, l'index.
const WORDS = [
  { text: "direction", col: 2, row: 0 },
  { text: "motion", col: 9, row: 1 },
  { text: "web", col: 1, row: 2 },
  { text: "paris", col: 9, row: 3 },
];

// Les filets, en part de la hauteur de l'écran : deux par mot (hauteur d'x et ligne de pied).
const ROWS = [0.13, 0.29, 0.45, 0.61];
const XH = 0.078;
const LINES = ROWS.flatMap((r) => [r, r + XH]);
// Les bandes qui partent à la sortie : entre chaque filet, plus le haut et le bas.
const CUTS = [0, ...LINES, 0.8, 1];

type Phase = "in" | "load" | "land" | "out";

export default function Poster({
  images,
  count,
  progress,
  onRelease,
  onDone,
}: {
  images: string[];
  count: number;
  progress: number;
  onRelease: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("in");
  const [frame, setFrame] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const shown = Math.floor(Math.min(progress, minDone ? 1 : 0.99) * 100);

  // Mise en place (0,9 s), puis au moins 1,6 s de défilement des images.
  useEffect(() => {
    const a = window.setTimeout(() => setPhase("load"), 900);
    const b = window.setTimeout(() => setMinDone(true), 2500);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  // Les images défilent vite, comme des planches qu'on feuillette.
  useEffect(() => {
    if (phase !== "load") return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % images.length), 140);
    return () => window.clearInterval(id);
  }, [phase, images.length]);

  // 100 % : l'image se pose sur le premier projet et prend sa couleur ; puis l'affiche part.
  // (Décidé pendant le rendu : passer par un effet afficherait une image de trop.)
  if (phase === "load" && shown >= 100) {
    setFrame(0);
    setPhase("land");
  }
  // Un effet par étape : la sortie ne doit pas annuler la minuterie de fin (ce qui laissait
  // l'image du cadre affichée pour toujours).
  useEffect(() => {
    if (phase !== "land") return;
    const id = window.setTimeout(() => {
      setPhase("out");
      onRelease();
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => {
    if (phase !== "out") return;
    const id = window.setTimeout(onDone, 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const sheet = (
    <div className={styles.sheet}>
      <div className={styles.band} />
      <div className={styles.diagonal} />
      <div className={styles.floor} />
      <i className={styles.rule} />
      {LINES.map((y, i) => (
        <i key={y} className={styles.line} style={{ top: `${y * 100}%`, "--i": i } as React.CSSProperties} />
      ))}

      <span className={styles.arrow} style={{ top: `${(ROWS[0] + XH / 2) * 100}%` }}>
        ↓
      </span>
      {WORDS.map((w, i) => (
        <span
          key={w.text}
          className={styles.word}
          style={{ top: `${ROWS[w.row] * 100}%`, "--c": w.col, "--i": i } as React.CSSProperties}
        >
          <span>
            <Scramble text={w.text} delay={250 + i * 120} duration={650} />
          </span>
        </span>
      ))}

      <p className={styles.aside} style={{ top: `calc(${ROWS[0] * 100}% + 10px)` }}>
        <Scramble text="Sélection" delay={600} />
        <Scramble text="2024 — 2026" delay={660} />
      </p>
      <span className={styles.vertical} style={{ top: `calc(${ROWS[2] * 100}% + 10px)` }}>
        {phase === "in" ? "" : "Chargement"}
      </span>
      <span className={styles.count} style={{ top: `calc(${ROWS[3] * 100}% + 10px)` }}>
        {String(shown).padStart(3, "0")}
      </span>

      <p className={styles.lead} style={{ top: `calc(${(ROWS[3] + XH) * 100}% + 10px)` }}>
        <Scramble text="Alternance" delay={800} />
        <Scramble text="2026 — 2027" delay={860} />
      </p>
      {/* Sa barre horizontale posée sur le dernier filet. */}
      <svg
        className={styles.mark}
        viewBox="0 0 90 60"
        aria-hidden="true"
        style={{ top: `calc(${(ROWS[3] + XH) * 100}% - 30px)` }}
      >
        <path d="M0 30H90M45 0V60M22 56L68 4" stroke="currentColor" strokeWidth="4" fill="none" />
      </svg>

      <div className={styles.foot}>
        {["Index", `${String(count).padStart(2, "0")} projets`, "Gobelins", "Paris, FR"].map((f, i) => (
          <Scramble key={f} text={f} delay={900 + i * 60} />
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.poster} data-phase={phase} aria-hidden="true" style={{ "--xh": XH } as React.CSSProperties}>
      {/* La même affiche, une fois par bande : chaque copie n'en montre qu'une tranche, et part
          à gauche ou à droite à la sortie. */}
      {CUTS.slice(0, -1).map((top, i) => (
        <div
          key={top}
          className={styles.strip}
          style={
            {
              clipPath: `inset(${top * 100}% 0 ${(1 - CUTS[i + 1]) * 100}% 0)`,
              "--dir": i % 2 ? 1 : -1,
              "--d": `${Math.abs(i - (CUTS.length - 2) / 2) * 35}ms`,
            } as React.CSSProperties
          }
        >
          {sheet}
        </div>
      ))}

      {/* Le cadre de la première feuille : les images défilent, en bichromie sur le rouge. */}
      <div className={styles.frame}>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" data-on={i === frame} decoding="async" />
        ))}
      </div>
    </div>
  );
}
