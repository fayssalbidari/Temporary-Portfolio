// L'identifiant du projet et le nom du dataset ne sont pas secrets :
// ils peuvent être publics. Ils peuvent être surchargés par des variables d'environnement.
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "4yipja2e";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-28";
