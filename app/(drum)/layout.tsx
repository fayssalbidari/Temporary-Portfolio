import type { SanityImageSource } from "@sanity/image-url";
import Drum from "@/components/Drum/Drum";
import { toSliderProjects } from "@/components/Slider/data";
import { getAboutPage, getHomePage, getProjects } from "@/lib/content";
import { urlFor } from "@/lib/sanity/image";

// La Home et la page À propos partagent ce layout : la scène WebGL reste montée d'une page à
// l'autre, et c'est elle qui fait la transition (la feuille se retourne et devient le portrait).
export default async function DrumLayout({ children }: { children: React.ReactNode }) {
  const [rawProjects, home, about] = await Promise.all([getProjects(), getHomePage(), getAboutPage()]);
  const projects = toSliderProjects(rawProjects);
  // « Directeur Artistique, Motion Designer, Web Developer » → une seule ligne en bas de casse.
  const roles = home.heroLines.map((l) => [l.strong, l.muted].filter(Boolean).join(" ")).join(", ");
  const tagline = roles.charAt(0) + roles.slice(1).toLowerCase();
  const portrait = about.portrait
    ? urlFor(about.portrait as SanityImageSource).width(900).height(1224).fit("crop").url()
    : null;
  return (
    <>
      {children}
      {projects.length > 0 ? <Drum projects={projects} tagline={tagline} portrait={portrait} /> : null}
    </>
  );
}
