import Link from "next/link";
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
          <Link className={`${styles.navLink} text-nav`} href="/about">
            About
          </Link>
        </div>
      </nav>
    </header>
  );
}
