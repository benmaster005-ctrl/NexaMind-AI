/**
 * Pastille du socle (story 7.1, variantes semantiques story 7.2).
 *
 * Sobre par defaut : un badge porte une information (role, categorie, compteur),
 * jamais une action — il reste donc en gris, sans couleur d'accent. La couleur
 * n'apparait qu'en variante, quand elle porte un sens (statut d'ingestion,
 * resultat d'operation) : `success`, `warning`, `danger`, adossees aux tokens
 * semantiques de la charte.
 */
import styles from "./ui.module.css";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASS: Record<Exclude<BadgeVariant, "neutral">, string> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variantClass = variant === "neutral" ? undefined : VARIANT_CLASS[variant];
  return (
    <span className={[styles.badge, variantClass, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

export default Badge;
