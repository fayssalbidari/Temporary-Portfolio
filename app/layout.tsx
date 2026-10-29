import type { Metadata } from "next";
import localFont from "next/font/local";
import ChromeGate from "@/components/ChromeGate/ChromeGate";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import PageTransition from "@/components/PageTransition/PageTransition";
import {
  siteDescription,
  siteName,
  siteTitle,
  siteUrl,
} from "@/lib/site";
import "./globals.css";

// PP Neue Montreal Regular : la seule graisse utilisée dans le Figma.
// Déclarée pour 400 et 500 afin que les deux poids du système de typo l'utilisent.
const neueMontreal = localFont({
  src: [
    {
      path: "./fonts/PPNeueMontreal-Regular.woff2",
      weight: "400 500",
      style: "normal",
    },
  ],
  variable: "--font-neue-montreal",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s - ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  keywords: [
    "Fayssal Bidari",
    "alternance directeur artistique Paris",
    "alternance direction artistique 2026-2027",
    "alternance motion design Paris",
    "alternance design digital",
    "alternance web design",
    "directeur artistique",
    "motion designer",
    "web developer",
    "master direction artistique Gobelins",
    "création numérique et interactive",
    "Gobelins",
    "freelance",
    "Paris",
    "Bruxelles",
    "portfolio",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={neueMontreal.variable} suppressHydrationWarning>
      <head>
        {/* Marque la Home comme « en intro » avant l'hydratation (le layout n'est rendu qu'une fois côté serveur). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(location.pathname==='/')document.documentElement.dataset.intro='pending'",
          }}
        />
      </head>
      <body>
        <ChromeGate>
          <Header />
        </ChromeGate>
        {children}
        <ChromeGate>
          <Footer />
        </ChromeGate>
        <PageTransition />
      </body>
    </html>
  );
}
