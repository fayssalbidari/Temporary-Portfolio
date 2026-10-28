"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

// Animation d'entrée de la page About : les textes montent ligne par ligne (SplitText + mask) et
// le portrait se dévoile avec un mask du bas vers le haut. Si une transition de page est en cours,
// on attend le dévoilement ("page:reveal").
export default function AboutReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-about]");
    if (!root) return;
    const html = document.documentElement;
    const image = root.querySelector<HTMLElement>("[data-about-image]");
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-about-block]"));
    const title = root.querySelector<HTMLElement>("[data-about-title]");

    const splits: SplitText[] = [];
    const split = (el: HTMLElement) => {
      const s = SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
      });
      splits.push(s);
      return s;
    };

    const titleSplit = title ? split(title) : null;
    const blockSplits = blocks.map((block) =>
      Array.from(block.querySelectorAll<HTMLElement>("[data-split]")).flatMap(
        (el) => split(el).lines,
      ),
    );

    if (titleSplit) gsap.set(titleSplit.lines, { yPercent: 110 });
    blockSplits.forEach((lines) => gsap.set(lines, { yPercent: 110 }));
    if (image) gsap.set(image, { clipPath: "inset(100% 0% 0% 0%)" });
    root.style.visibility = "visible";

    let tl: gsap.core.Timeline | null = null;
    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      if (titleSplit) tl.to(titleSplit.lines, { yPercent: 0, duration: 1.1, stagger: 0.09 }, 0);
      if (image) {
        tl.to(
          image,
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2, ease: "power4.inOut" },
          0.25,
        );
      }
      blockSplits.forEach((lines, i) => {
        tl?.to(lines, { yPercent: 0, duration: 1, stagger: 0.05 }, 0.3 + i * 0.14);
      });
    };

    const waiting = html.dataset.transition === "running";
    let safety = 0;
    if (waiting) {
      window.addEventListener("page:reveal", play);
      safety = window.setTimeout(play, 9000);
    } else {
      play();
    }

    return () => {
      window.removeEventListener("page:reveal", play);
      window.clearTimeout(safety);
      tl?.kill();
      splits.forEach((s) => s.revert());
      if (image) gsap.set(image, { clearProps: "clipPath" });
    };
  }, []);

  return null;
}
