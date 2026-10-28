import { getHomePage } from "@/lib/content";
import styles from "./Hero.module.css";

export default async function Hero() {
  const { heroLines, heroIntro } = await getHomePage();

  return (
    <section className={`${styles.hero} dot-grid`}>
      <div className={styles.heroContent} data-intro-gate>
        <div className={styles.heroRole}>
          <h1 className={`${styles.heroTitle} text-title`}>
            {heroLines.map((line, index) => (
              <span className={styles.heroLine} key={index}>
                {line.strong}
                {line.strong && line.muted ? " " : ""}
                <span className="grey">{line.muted}</span>
              </span>
            ))}
          </h1>
        </div>
        <p className={`${styles.heroCopy} text-body`}>{heroIntro}</p>
      </div>
    </section>
  );
}
