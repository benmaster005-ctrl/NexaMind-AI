/**
 * En-tete de page du socle (story 7.3).
 *
 * Un seul h1 par ecran : le titre de la page est rendu ici, jamais par un
 * `CardTitle` (qui reste le h2 des sections). La description est optionnelle et
 * les actions eventuelles restent a droite, y compris sur ecran etroit (elles
 * passent simplement a la ligne).
 *
 * Composant SANS etat : utilisable depuis un Server Component comme depuis un
 * composant client, sans JavaScript ajoute.
 */
import styles from "./ui.module.css";

interface PageHeaderProps {
  /** Titre de la page : unique h1 de l'ecran. */
  title: string;
  /** Phrase d'explication : ce que l'ecran permet de faire, en une ligne. */
  description?: string;
  /** Actions principales de la page (bouton, badge de contexte). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={[styles.pageHeader, className].filter(Boolean).join(" ")}>
      <div className={styles.pageHeaderText}>
        <h1 className={styles.pageHeaderTitle}>{title}</h1>
        {description ? (
          <p className={styles.pageHeaderDescription}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
