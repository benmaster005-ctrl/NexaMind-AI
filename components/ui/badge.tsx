/**
 * Pastille neutre du socle (story 7.1).
 *
 * Sobre par arbitrage : un badge porte une information (role, categorie,
 * compteur), jamais une action — il reste donc en gris, sans couleur d'accent.
 */
import styles from "./ui.module.css";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={[styles.badge, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

export default Badge;
