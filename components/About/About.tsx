import type { SanityImageSource } from "@sanity/image-url";
import Image from "next/image";
import LinkedText from "@/components/LinkedText/LinkedText";
import { getAboutPage } from "@/lib/content";
import { urlFor } from "@/lib/sanity/image";
import AboutReveal from "./AboutReveal";
import styles from "./About.module.css";

export default async function About() {
  const { headline, portrait, biography, expertise, contactText } =
    await getAboutPage();

  return (
    <section className={`${styles.aboutSection} dot-grid`} data-about>
      <AboutReveal />
      <div className={styles.aboutContent}>
        <div className={styles.aboutLead}>
          <h1 className={`${styles.aboutTitle} text-card-title`} data-about-title>{headline}</h1>
          {portrait ? (
            <Image
              className={styles.aboutImage}
              src={urlFor(portrait as SanityImageSource).width(260).height(390).fit("crop").url()}
              alt={portrait.alt || "Portrait de Fayssal Bidari"}
              width={130}
              height={195}
              unoptimized
              data-about-image
            />
          ) : null}
        </div>

        <div className={styles.aboutDetails}>
          <article className={styles.aboutBlock} data-about-block>
            <h2 className={`${styles.aboutLabel} text-tag`} data-split>Biography</h2>
            <div className={`${styles.aboutParagraphs} text-longform`}>
              {biography.map((paragraph, index) => (
                <p key={index} data-split>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className={styles.aboutBlock} data-about-block>
            <h2 className={`${styles.aboutLabel} text-tag`} data-split>Expertise</h2>
            <ul className={`${styles.aboutList} text-longform`}>
              {expertise.map((item) => (
                <li key={item} data-split>{item}</li>
              ))}
            </ul>
          </article>

          <article className={styles.aboutBlock} data-about-block>
            <h2 className={`${styles.aboutLabel} text-tag`} data-split>Contact</h2>
            <p className="text-longform" data-split>
              <LinkedText text={contactText} linkClassName={styles.aboutLink} />
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
