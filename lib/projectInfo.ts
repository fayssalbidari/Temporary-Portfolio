// Fiche de chaque projet, affichée sur la Home (année, rôle, outils, contexte).
// ⚠ Rédigé à partir des descriptions Sanity pour la maquette : à vérifier et corriger par
// Fayssal, puis à déplacer dans Sanity (champs du document « project »).

export type ProjectInfo = {
  year: string;
  role: string;
  tools: string;
  context: string;
};

const INFO: Record<string, ProjectInfo> = {
  "Chery Group France": {
    year: "2025–26",
    role: "Direction artistique, motion",
    tools: "Figma, After Effects",
    context: "Alternance",
  },
  "2100": {
    year: "2025",
    role: "Direction artistique, développement 3D",
    tools: "Three.js, Blender",
    context: "Gobelins",
  },
  "Colors CBD": {
    year: "2024",
    role: "Identité, packaging, e-commerce",
    tools: "Illustrator, Shopify",
    context: "Freelance",
  },
  "The Muse 'Folio": {
    year: "2024",
    role: "Direction artistique, web design",
    tools: "Figma, GSAP",
    context: "Freelance, Bruxelles",
  },
  Ono: {
    year: "2025",
    role: "Direction artistique, illustration, 3D",
    tools: "Three.js, Blender",
    context: "Gobelins",
  },
  "Mess Up !": {
    year: "2025",
    role: "Direction artistique, game design",
    tools: "Three.js, GSAP",
    context: "Gobelins",
  },
  "Casa Lunara": {
    year: "2025",
    role: "Direction artistique, WebGL",
    tools: "WebGL, GSAP",
    context: "Projet personnel",
  },
};

export const projectInfo = (title: string): ProjectInfo | null => INFO[title] ?? null;
