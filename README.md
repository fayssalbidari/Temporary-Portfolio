# Portfolio – Fayssal Bidari

Site en Next.js 16 (App Router), React 19, Tailwind 4, GSAP et Lenis.

## Lancer le projet

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## Structure

- `app/` : pages (`/`, `/about`), métadonnées, `robots`, `sitemap`
- `components/` : Header, Footer, Hero, About, JsonLd
- `lib/site.ts` : nom, URL, descriptions SEO et liens sociaux (une seule source)
- `public/` : images et polices

## À faire

- Ajouter Arnika (titres) avec `next/font/local`, comme PP Neue Montreal dans `app/layout.tsx`
- Ajouter une image de partage `app/opengraph-image.png` (1200 × 630)
- Construire le slider de projets

> Next.js 16 diffère des versions précédentes : consulter `node_modules/next/dist/docs/` avant de coder.
