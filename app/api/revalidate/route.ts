import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

// Webhook Sanity : à chaque publication, le contenu du site est rafraîchi tout de suite
// (sans attendre la revalidation automatique d'une minute).
// Variable d'environnement requise : SANITY_REVALIDATE_SECRET (la même que dans le webhook Sanity).
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "SANITY_REVALIDATE_SECRET manquant" }, { status: 500 });
  }

  const { isValidSignature } = await parseBody(req, secret);
  if (!isValidSignature) {
    return NextResponse.json({ message: "Signature invalide" }, { status: 401 });
  }

  revalidateTag("sanity", { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
