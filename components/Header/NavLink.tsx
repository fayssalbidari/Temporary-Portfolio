"use client";

import { usePathname } from "next/navigation";
import DotLink from "@/components/DotLink/DotLink";

// Lien de navigation : le point reste visible quand on est sur la page correspondante.
export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <DotLink href={href} active={pathname === href} className="text-nav">
      {children}
    </DotLink>
  );
}
