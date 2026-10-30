import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le badge de développement de Next se posait sur l'index des projets.
  devIndicators: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
