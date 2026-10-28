type JsonLdProps = {
  data: Record<string, unknown>;
};

// Le "<" est remplacé par son équivalent unicode pour empêcher toute injection
// de balise dans le script (recommandation de la doc Next.js).
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
