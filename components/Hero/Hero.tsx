import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroRole}>
            <h1 className={`${styles.heroTitle} text-title`}>
              <span className={styles.heroLine}>Directeur <span className="grey">Artistique</span></span>
              <span className={styles.heroLine}>Web <span className="grey">Developer</span></span>
              <span className={styles.heroLine}>Motion <span className="grey">Designer</span></span>
            </h1>
          </div>
          <p className={`${styles.heroCopy} text-body`}>
            Directeur Artistique, développeur web et Motion Designer à Paris, je conçois des expériences numériques créatives et des identités sur mesure pour votre marque.
          </p>
        </div>
    </section>
  );
}