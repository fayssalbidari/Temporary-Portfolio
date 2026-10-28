import Hero from "@/components/Hero/Hero";
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
        "Développeur web",
        "Motion Designer",
        "Freelance Designer",
      ],
      knowsAbout: [
        "Direction artistique",
        "Design digital",
        "Web design",
        "Développement web",
        "Webflow",
        "Motion design",
        "Identité visuelle",
        "Expérience numérique",
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
      name: `${siteName} - Freelance Designer, Développeur & Motion Designer`,
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
        "Design digital",
        "Développement web",
        "Motion design",
        "Identité visuelle",
      ],
      description:
        "Services freelance en direction artistique, design digital, développement web et motion design pour des marques basées à Paris, Bruxelles, en France et en Belgique.",
    },
  ],
};

export default function Home() {
  return (
    <main>
      <JsonLd data={structuredData} />
      <Hero />
    </main>
  );
}
