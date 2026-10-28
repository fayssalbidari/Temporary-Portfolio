import { siteName, socials } from "@/lib/site";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} data-intro-gate>
      <div className={styles.footerContent}>
        <p className={`${styles.footerCopy} text-link`}>© 2026 {siteName}</p>
        <div className={styles.footerLinks}>
          <a
            className={`${styles.footerLink} text-link`}
            href={socials.instagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
          <a
            className={`${styles.footerLink} text-link`}
            href={socials.linkedin}
            target="_blank"
            rel="noopener noreferrer"
          >
            Linkedin
          </a>
          <a className={`${styles.footerLink} text-link`} href={socials.email}>
            Mail
          </a>
        </div>
      </div>
    </footer>
  );
}
