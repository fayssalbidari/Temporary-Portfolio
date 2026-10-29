import { getHomePage } from "@/lib/content";
import SplitReveal from "./SplitReveal";
import styles from "./Hero.module.css";

export default async function Hero() {
  const { heroLines, heroIntro } = await getHomePage();

  return (
    <section className={`${styles.hero} dot-grid`}>
      <div className={styles.heroContent} data-hero-content>
        <div className={styles.heroRole}>
          <SplitReveal as="h1" className={`${styles.heroTitle} text-title`} stagger={0.1}>
            {heroLines.map((line, index) => (
              <span className={styles.heroLine} key={index}>
                {line.strong}
                {line.strong && line.muted ? " " : ""}
                <span className="grey">{line.muted}</span>
              </span>
            ))}
          </SplitReveal>
        </div>
        <SplitReveal as="p" className={`${styles.heroCopy} text-body`} delay={0.25} stagger={0.07}>
          {heroIntro}
        </SplitReveal>
      </div>
    </section>
  );
}
