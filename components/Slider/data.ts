import { urlFor } from "@/lib/sanity/image";
import type { Project } from "@/lib/sanity/types";
import type { SliderProject } from "./types";

// Transforme les projets Sanity en données prêtes pour le slider (URLs d'images comprises).
export function toSliderProjects(projects: Project[]): SliderProject[] {
  return projects
    .filter((project) => project.images.length > 0)
    .map((project) => ({
      id: project._id,
      title: project.title,
      type: project.projectType,
      description: project.description,
      link: project.link,
      linkLabel: project.linkLabel?.trim() || "See Project",
      images: project.images.map((image, index) => ({
        key: image._key,
        src: urlFor(image.source).width(1200).quality(82).auto("format").url(),
        alt:
          image.alt?.trim() ||
          `${project.title} — image ${index + 1} sur ${project.images.length}`,
      })),
    }));
}
