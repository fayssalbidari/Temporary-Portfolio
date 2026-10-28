import Link from "next/link";
import NavLink from "./NavLink";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.navbar} aria-label="Navigation principale">
        <Link
          className={`${styles.logo} text-logo`}
          href="/"
          aria-label="Fayssal Bidari, accueil"
        >
          FB
        </Link>

        <div className={styles.navbarLinks}>
          <NavLink href="/about">About</NavLink>
        </div>
      </nav>
    </header>
  );
}
