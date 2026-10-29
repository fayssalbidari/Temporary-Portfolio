import type { Metadata } from "next";
import AboutSection from "@/components/About/About";
import JsonLd from "@/components/JsonLd/JsonLd";
import { personId, siteName, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Originaire de Bruxelles et basé à Paris, Fayssal Bidari est directeur artistique, web developer et motion designer. Formé à l'HEAJ à Namur puis aux Gobelins, en recherche d'une alternance à Paris pour l'année scolaire 2026-2027.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: `${siteUrl}/about`,
    siteName,
    title: `About - ${siteName}`,
    description:
      "Originaire de Bruxelles et basé à Paris, Fayssal Bidari est directeur artistique, web developer et motion designer. Formé à l'HEAJ à Namur puis aux Gobelins, en recherche d'une alternance à Paris pour l'année scolaire 2026-2027.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `About - ${siteName}`,
    description:
      "Originaire de Bruxelles et basé à Paris, Fayssal Bidari est directeur artistique, web developer et motion designer. Formé à l'HEAJ à Namur puis aux Gobelins, en recherche d'une alternance à Paris pour l'année scolaire 2026-2027.",
    images: ["/twitter-image.png"],
  },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `À propos de ${siteName}`,
  url: `${siteUrl}/about`,
  mainEntity: {
    "@type": "Person",
    "@id": personId,
    name: siteName,
    url: siteUrl,
    jobTitle: [
      "Directeur Artistique",
      "Développeur web",
      "Motion Designer",
      "Freelance Designer",
    ],
    birthPlace: { "@type": "Place", name: "Bruxelles" },
    areaServed: ["Paris", "Bruxelles", "France", "Belgique"],
    alumniOf: [
      {
        "@type": "CollegeOrUniversity",
        name: "HEAJ",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Namur",
          addressCountry: "BE",
        },
      },
      {
        "@type": "CollegeOrUniversity",
        name: "Gobelins, l'école de l'image",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Paris",
          addressCountry: "FR",
        },
      },
    ],
    knowsAbout: [
      "Direction artistique",
      "Design digital",
      "Développement web",
      "Webflow",
      "Motion design",
      "Identité visuelle",
      "Expériences numériques",
      "Création numérique interactive",
    ],
  },
};

export default function About() {
  return (
    <main>
      <JsonLd data={aboutJsonLd} />
      <AboutSection />
    </main>
  );
}
