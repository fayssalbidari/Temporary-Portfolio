import JsonLd from "@/components/JsonLd/JsonLd";
import {
  personId,
  siteLongDescription,
  siteName,
  siteUrl,
  socials,
} from "@/lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": personId,
      name: siteName,
      url: siteUrl,
      jobTitle: [
        "Directeur Artistique",
        "Motion Designer",
        "Web designer",
        "Développeur web",
        "Freelance Designer",
      ],
      knowsAbout: [
        "Direction artistique",
        "Motion design",
        "Identité visuelle",
        "Design digital",
        "Web design",
        "UI design",
        "Figma",
        "Expérience numérique",
        "Création numérique interactive",
        "Développement web",
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Paris",
        addressCountry: "FR",
      },
      workLocation: [
        { "@type": "Place", name: "Paris, France" },
        { "@type": "Place", name: "Bruxelles, Belgique" },
      ],
      sameAs: [socials.instagram, socials.linkedin],
      description: siteLongDescription,
    },
    {
      "@type": "ProfessionalService",
      "@id": `${siteUrl}/#service`,
      name: `${siteName} - Freelance Directeur Artistique, Motion Designer & Développeur web`,
      url: siteUrl,
      founder: { "@id": personId },
      areaServed: [
        { "@type": "City", name: "Paris" },
        { "@type": "City", name: "Bruxelles" },
        { "@type": "Country", name: "France" },
        { "@type": "Country", name: "Belgique" },
      ],
      serviceType: [
        "Direction artistique",
        "Motion design",
        "Identité visuelle",
        "Design digital",
        "Développement web",
      ],
      description:
        "Services freelance en direction artistique, motion design, design digital et développement web pour des marques basées à Paris, Bruxelles, en France et en Belgique.",
    },
  ],
};

// La scène (le slider des projets) est dans le layout partagé avec À propos.
export default function Home() {
  return (
    <main data-home style={{ position: "relative" }}>
      <JsonLd data={structuredData} />
    </main>
  );
}
