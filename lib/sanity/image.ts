import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

// Construit l'URL d'une image Sanity (recadrage et point focal pris en compte).
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
