import { defaultAbout, defaultHome } from "@/lib/defaults";
import { client } from "@/lib/sanity/client";
import {
  aboutPageQuery,
  homePageQuery,
  projectsQuery,
} from "@/lib/sanity/queries";
import type {
  AboutPageContent,
  HomePageContent,
  Project,
} from "@/lib/sanity/types";

// Le site se met à jour tout seul : les pages sont régénérées au plus tard 60 secondes
// après une publication dans Sanity.
const fetchOptions = { next: { revalidate: 60, tags: ["sanity"] } };

function cleanList(list: (string | null)[] | null | undefined): string[] {
  return (list ?? []).filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

export async function getHomePage(): Promise<HomePageContent> {
  try {
    const data = await client.fetch<Partial<HomePageContent> | null>(
      homePageQuery,
      {},
      fetchOptions,
    );

    const heroLines = (data?.heroLines ?? []).filter(
      (line) => line?.strong?.trim() || line?.muted?.trim(),
    );

    return {
      heroLines: heroLines.length > 0 ? heroLines : defaultHome.heroLines,
      heroIntro: data?.heroIntro?.trim() || defaultHome.heroIntro,
    };
  } catch (error) {
    console.error("Sanity : impossible de lire la page d'accueil", error);
    return defaultHome;
  }
}

export async function getAboutPage(): Promise<AboutPageContent> {
  try {
    const data = await client.fetch<
      (Partial<Omit<AboutPageContent, "biography" | "expertise">> & {
        biography?: (string | null)[] | null;
        expertise?: (string | null)[] | null;
      }) | null
    >(aboutPageQuery, {}, fetchOptions);

    const biography = cleanList(data?.biography);
    const expertise = cleanList(data?.expertise);

    return {
      headline: data?.headline?.trim() || defaultAbout.headline,
      portrait: data?.portrait?.asset ? data.portrait : null,
      biography: biography.length > 0 ? biography : defaultAbout.biography,
      expertise: expertise.length > 0 ? expertise : defaultAbout.expertise,
      contactText: data?.contactText?.trim() || defaultAbout.contactText,
    };
  } catch (error) {
    console.error("Sanity : impossible de lire la page About", error);
    return defaultAbout;
  }
}

// Utilisée par le slider : une liste de projets, chacun avec ses images (nombre libre).
export async function getProjects(): Promise<Project[]> {
  try {
    const projects = await client.fetch<Project[] | null>(
      projectsQuery,
      {},
      fetchOptions,
    );

    return (projects ?? []).map((project) => ({
      ...project,
      images: project.images ?? [],
    }));
  } catch (error) {
    console.error("Sanity : impossible de lire les projets", error);
    return [];
  }
}
