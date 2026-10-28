import type {
  AboutPageContent,
  HomePageContent,
} from "@/lib/sanity/types";

// Textes affichés tant que le contenu n'est pas rempli dans Sanity
// (ou si Sanity est momentanément injoignable).
export const defaultHome: HomePageContent = {
  heroLines: [
    { strong: "Directeur", muted: "Artistique" },
    { strong: "Web", muted: "Developer" },
    { strong: "Motion", muted: "Designer" },
  ],
  heroIntro:
    "Directeur Artistique, développeur web et Motion Designer à Paris, je conçois des expériences numériques créatives et des identités sur mesure pour votre marque.",
};

export const defaultAbout: AboutPageContent = {
  headline:
    "Originaire de Bruxelles, basé à Paris, je conçois des expériences numériques entre direction artistique, développement web et motion design.",
  portrait: null,
  biography: [
    "Après des études à l'HEAJ à Namur, j'ai rejoint les Gobelins à Paris pour un master Expert en création numérique et interactive.",
    "Entre mon alternance chez Flot Noir et mon stage chez Karim Saab, je me suis forgé une expérience solide en direction artistique, design digital, développement web, motion design et systèmes d'interaction.",
    "Aujourd'hui, j'accompagne des marques, studios et indépendants en France et en Belgique sur des portfolios, sites vitrines, landing pages, identités numériques, animations web et expériences interactives sur mesure.",
  ],
  expertise: [
    "Direction artistique",
    "Web design et développement web",
    "Motion design et interactions créatives",
    "Identité visuelle et expérience numérique",
  ],
  contactText:
    "Pour une alternance, une collaboration à Paris, Bruxelles, en France ou en Belgique, vous pouvez me contacter par [mail](mailto:faysalbida@gmail.com), [Instagram](https://www.instagram.com/fayssal_design/) ou [LinkedIn](https://www.linkedin.com/in/fayssal-bidari-766620312/).",
};
