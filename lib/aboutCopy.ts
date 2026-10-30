// Page À propos : le texte, sobre et factuel (les faits viennent de la biographie Sanity).
// À valider par Fayssal, puis à remettre dans Sanity (document « aboutPage »).

export const aboutCopy = {
  // En Monument : les trois disciplines, rien d'autre.
  statement: ["Direction artistique", "Motion design", "Développement web"],
  lead: "Directeur artistique et motion designer, basé à Paris. Formé à l'HEAJ puis aux Gobelins. En recherche d'une alternance pour 2026–27.",
  facts: [
    { label: "Formation", lines: ["Gobelins, Paris — master Création numérique et interactive", "HEAJ, Namur"] },
    { label: "Expérience", lines: ["Flot Noir — alternance, 1 an", "Karim Saab — stage"] },
    { label: "Disciplines", lines: ["Identité visuelle, design digital", "Motion design, Webflow"] },
  ],
  cta: "Contact",
  availability: "Paris — alternance 2026–27",
} as const;
