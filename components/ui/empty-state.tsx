/**
 * Etat vide du socle (story 7.1) : un seul rendu pour « rien a afficher ».
 */
import styles from "./ui.module.css";

interface EmptyStateProps {
  children: React.ReactNode;
  className?: string;
}

export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <p className={[styles.empty, className].filter(Boolean).join(" ")}>{children}</p>
  );
}

export default EmptyState;
