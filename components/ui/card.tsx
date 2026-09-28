/**
 * Carte du socle (story 7.1) : un seul contenant pour tous les blocs de contenu
 * (fond, bordure, rayon et ombre issus des tokens).
 */
import styles from "./ui.module.css";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </section>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
}

export function CardTitle({ children }: CardTitleProps) {
  return <h2 className={styles.cardTitle}>{children}</h2>;
}

export default Card;
