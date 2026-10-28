import type { SanityImageSource } from "@sanity/image-url";

export type SanityPortrait = {
  alt?: string;
  asset?: { _ref?: string; _id?: string } | null;
  hotspot?: unknown;
  crop?: unknown;
};

export type HeroLine = {
  strong: string;
  muted: string;
};

export type HomePageContent = {
  heroLines: HeroLine[];
  heroIntro: string;
};

export type AboutPageContent = {
  headline: string;
  portrait: SanityPortrait | null;
  biography: string[];
  expertise: string[];
  contactText: string;
};

export type ProjectImage = {
  _key: string;
  alt?: string;
  width?: number;
  height?: number;
  // Source Sanity de l'image, à passer à urlFor().
  source: SanityImageSource;
};

export type Project = {
  _id: string;
  title: string;
  slug: string | null;
  projectType: string | null;
  description: string | null;
  link: string | null;
  linkLabel: string | null;
  images: ProjectImage[];
};
