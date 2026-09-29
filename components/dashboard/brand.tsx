/**
 * Marque NexaMind (refonte dashboard 2026-09-29).
 *
 * Sigle abstrait et geometrique : quatre carres pleins sur une grille
 * reguliere, dans l'accent bleu de la charte. Aucun symbole d'intelligence
 * artificielle (cerveau, robot, etincelles, orbites) : l'IA est une
 * fonctionnalite du produit, pas son identite visuelle.
 *
 * La marque ramene a l'accueil (`/`) : c'est le seul chemin de retour, donc
 * l'en-tete n'a pas besoin d'un onglet « Accueil » supplementaire. Le sigle est
 * `aria-hidden` et le mot-symbole reste du texte : selectionnable, accessible
 * et jamais remplace par une image chargee depuis un CDN.
 */
import Link from "next/link";

import styles from "./dashboard-home.module.css";

export default function Brand() {
  return (
    <Link className={styles.brand} href="/">
      <svg
        className={styles.brandMark}
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </svg>
      <span className={styles.brandName}>NexaMind AI</span>
    </Link>
  );
}