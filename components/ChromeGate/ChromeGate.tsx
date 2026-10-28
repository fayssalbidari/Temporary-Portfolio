"use client";

import { usePathname } from "next/navigation";

// Masque le header et le footer du site sur le Studio Sanity.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/studio")) return null;
  return <>{children}</>;
}
