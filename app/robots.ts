import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Robots des moteurs de recherche et des assistants IA (ChatGPT, Claude, Perplexity, Google, Apple) :
// tous sont autorisés explicitement à lire le site, sauf le Studio Sanity.
const bots = [
  "*",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: bots.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: "/studio",
    })),
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
