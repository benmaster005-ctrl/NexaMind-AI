/**
 * Jeu d'icones SVG du socle (story 7.1).
 *
 * Sobres par construction : trait de 1,5 px, `currentColor` (donc l'etat actif
 * se colore tout seul), sans dependance externe ni requete reseau. Composant
 * SANS etat : utilisable depuis un Server Component.
 */
import type { IconName } from "@/lib/dashboard/helpers";

interface IconProps {
  name: IconName;
  className?: string;
}

const PATHS: Record<IconName, string> = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z",
  search: "M11 4a7 7 0 1 0 4.19 12.61L20 21.42 21.42 20l-4.81-4.81A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z",
  chat: "M20 5H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3v4l5-4h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z",
  history: "M12 4a8 8 0 1 1-7.4 5.06l-1.9-.4A10 10 0 1 0 12 2v2zm1 4h-2v7l5 3 1-1.7-4-2.4z",
  // Dossier ouvert : l'icone du depot documentaire partage.
  documents: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3zm0 3h18l-1.6 8.6a2 2 0 0 1-2 1.4H6.6a2 2 0 0 1-2-1.6z",
  // Fleche montante dans un bac : televersement.
  upload: "M12 15V4m0 0L8.5 7.5M12 4l3.5 3.M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  // Fiche : sortie vers le document complet.
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5",
  // Envoi : avion en papier, convention universelle du bouton « envoyer ».
  send: "M22 2 11 13M22 2 15 22 11 13 2 9 22 2Z",
  // Suite logique : fleche vers la droite (appel a l'action des blocs).
  arrow: "M5 12h14M13 6l6 6-6 6",
  // Sortie de session : fleche vers une porte.
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10",
};

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export default Icon;
