import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./DotLink.module.css";

type DotLinkProps = {
  href: string;
  children: ReactNode;
  // Garde le point visible (ex. lien de la page courante).
  active?: boolean;
  // "sm" : point de 4 px (navigation). "md" : point de 7 px (lien « See Project »).
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
};

// Lien avec un point qui apparaît au survol : le texte se décale pour lui faire de la place.
// Sans survol, seul le texte est visible, aligné.
export default function DotLink({
  href,
  children,
  active = false,
  size = "sm",
  className = "",
  ariaLabel,
}: DotLinkProps) {
  const classes = `${styles.link} ${size === "md" ? styles.md : styles.sm} ${className}`.trim();
  const content = (
    <>
      <span className={styles.dot} aria-hidden="true" />
      <span>{children}</span>
    </>
  );

  if (href.startsWith("/")) {
    return (
      <Link
        className={classes}
        href={href}
        data-active={active}
        aria-current={active ? "page" : undefined}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  const external = /^https?:/i.test(href);
  return (
    <a
      className={classes}
      href={href}
      data-active={active}
      aria-label={ariaLabel}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}
