"use client";

import { useEffect, useRef, useState } from "react";

// Lettres qui se mélangent avant de se poser, de gauche à droite : la façon dont le texte entre
// partout sur le site (préchargement, interface, fiche du projet). Chaque caractère tire au sort
// dans sa propre famille (majuscules, minuscules, chiffres) pour garder la silhouette du mot ;
// les espaces et la ponctuation ne bougent pas.
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SIGNS = "#%&*+=/<>";

function pick(ch: string) {
  const set = /[A-ZÀ-Ý]/.test(ch) ? UPPER : /[a-zà-ÿ]/.test(ch) ? LOWER : /\d/.test(ch) ? DIGITS : null;
  if (!set) return ch;
  // Un signe de temps en temps : le grain « code » du mélange.
  const from = Math.random() < 0.12 ? SIGNS : set;
  return from[Math.floor(Math.random() * from.length)];
}

export default function Scramble({
  text,
  play = true,
  delay = 0,
  duration = 520,
  className,
}: {
  text: string;
  play?: boolean;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const raf = useRef(0);

  useEffect(() => {
    if (!play) return;
    const chars = [...text];
    const start = performance.now() + delay;
    // Chaque lettre se pose à son tour ; le mot entier tient dans « duration ».
    const settle = chars.map((_, i) => (i / Math.max(chars.length - 1, 1)) * duration * 0.6 + duration * 0.4);
    let last = 0;
    const tick = (now: number) => {
      const t = now - start;
      // Pendant l'attente aussi, les lettres tournent : rien ne s'affiche « en clair » trop tôt.
      if (now - last > 40) {
        last = now;
        setShown(chars.map((ch, i) => (t >= settle[i] ? ch : pick(ch))).join(""));
      }
      if (t < duration) raf.current = requestAnimationFrame(tick);
      else setShown(text);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, play, delay, duration]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
