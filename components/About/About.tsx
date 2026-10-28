import Image from "next/image";
import { socials } from "@/lib/site";
import styles from "./About.module.css";

const biography = [
  "Après des études à l'HEAJ à Namur, j'ai rejoint les Gobelins à Paris pour un master Expert en création numérique et interactive.",
  "Entre mon alternance chez Flot Noir et mon stage chez Karim Saab, je me suis forgé une expérience solide en direction artistique, design digital, développement web, motion design et systèmes d'interaction.",
  "Aujourd'hui, j'accompagne des marques, studios et indépendants en France et en Belgique sur des portfolios, sites vitrines, landing pages, identités numériques, animations web et expériences interactives sur mesure.",
];

const expertise = [
  "Direction artistique",
  "Web design et développement web",
  "Motion design et interactions créatives",
  "Identité visuelle et expérience numérique",
];

export default function About() {
  return (
    <section className={styles.aboutSection}>
      <div className={styles.aboutContent}>
        <div className={styles.aboutLead}>
          <h1 className={`${styles.aboutTitle} text-card-title`}>
            Originaire de Bruxelles, basé à Paris, je conçois des expériences numériques entre
            direction artistique, développement web et motion design.
          </h1>
          <Image
            className={styles.aboutImage}
            src="/about/About.webp"
            alt="Portrait de Fayssal Bidari"
            width={130}
            height={195}
            unoptimized
          />
        </div>

        <div className={styles.aboutDetails}>
          <article className={styles.aboutBlock}>
            <h2 className={`${styles.aboutLabel} text-tag`}>Biography</h2>
            <div className={`${styles.aboutParagraphs} text-longform`}>
              {biography.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className={styles.aboutBlock}>
            <h2 className={`${styles.aboutLabel} text-tag`}>Expertise</h2>
            <ul className={`${styles.aboutList} text-longform`}>
              {expertise.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className={styles.aboutBlock}>
            <h2 className={`${styles.aboutLabel} text-tag`}>Contact</h2>
            <p className="text-longform">
              Pour une alternance, une collaboration à Paris, Bruxelles, en France ou en
              Belgique, vous pouvez me contacter par{" "}
              <a className={styles.aboutLink} href={socials.email}>
                mail
              </a>
              ,{" "}
              <a
                className={styles.aboutLink}
                href={socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>{" "}
              ou{" "}
              <a
                className={styles.aboutLink}
                href={socials.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
