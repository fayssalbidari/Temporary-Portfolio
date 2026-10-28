import { siteName, socials } from "@/lib/site";
import DotLink from "@/components/DotLink/DotLink";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} data-intro-gate>
      <div className={styles.footerContent}>
        <p className={`${styles.footerCopy} text-link`}>© 2026 {siteName}</p>
        <div className={styles.footerLinks}>
          <DotLink href={socials.instagram} className="text-link">
            Instagram
          </DotLink>
          <DotLink href={socials.linkedin} className="text-link">
            Linkedin
          </DotLink>
          <DotLink href={socials.email} className="text-link">
            Mail
          </DotLink>
        </div>
      </div>
    </footer>
  );
}
