/**
 * Navigation principale du socle (story 7.1, refonte dashboard 2026-09-29).
 *
 * Remplace le bloc `<nav>` qui etait recopie dans les 7 pages. Composant sans
 * etat : la page indique son propre onglet via `active`, donc aucun JavaScript
 * cote client.
 *
 * Deux presentations, un seul markup et un seul jeu d'onglets :
 * - `sidebar` (defaut) : barre basse 64px sur mobile, colonne 260px sur desktop
 *   (ecrans de travail : recherche, assistant, historique, documents, fiche) ;
 * - `topbar` : en-tete horizontal compact — marque a gauche, onglets au centre,
 *   compte a droite. Utilise par le tableau de bord, qui n'a pas de sidebar.
 *   `brand` et `actions` sont des slots rendus par la page (ils peuvent
 *   contenir un composant client comme la deconnexion).
 */
import Link from "next/link";

import type { NavItem } from "@/lib/dashboard/helpers";
import { isNavItemActive } from "@/lib/dashboard/helpers";
import { Icon } from "./icon";
import styles from "./ui.module.css";

export type AppNavVariant = "sidebar" | "topbar";

interface AppNavProps {
  items: NavItem[];
  /** Href de la page courante (ou de sa section) pour marquer l'onglet actif. */
  active: string;
  /** Presentation : colonne (defaut) ou en-tete horizontal. */
  variant?: AppNavVariant;
  /** En-tete uniquement : logo/marque a gauche. */
  brand?: React.ReactNode;
  /** En-tete uniquement : compte et actions a droite. */
  actions?: React.ReactNode;
}

export function AppNav({ items, active, variant = "sidebar", brand, actions }: AppNavProps) {
  const renderItem = (item: NavItem, className: string, iconClassName?: string) => {
    const isActive = isNavItemActive(item.href, active);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={className}
        aria-current={isActive ? "page" : undefined}
      >
        {/* En-tete horizontal : libelle seul (les icones y feraient doublon
            avec celles des blocs d'action). Sidebar : libelle + icone. */}
        {iconClassName ? <Icon name={item.icon} className={iconClassName} /> : null}
        <span>{item.label}</span>
      </Link>
    );
  };

  if (variant === "topbar") {
    return (
      <header className={styles.topbar}>
        {brand ? <div className={styles.topBrand}>{brand}</div> : null}
        <nav className={styles.topNav} aria-label="Navigation principale">
          {items.map((item) =>
            renderItem(
              item,
              [
                styles.topItem,
                isNavItemActive(item.href, active) ? styles.topItemActive : "",
              ]
                .filter(Boolean)
                .join(" "),
            ),
          )}
        </nav>
        {actions ? <div className={styles.topActions}>{actions}</div> : null}
      </header>
    );
  }

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {items.map((item) =>
        renderItem(
          item,
          [styles.navItem, isNavItemActive(item.href, active) ? styles.navItemActive : ""]
            .filter(Boolean)
            .join(" "),
          styles.navIcon,
        ),
      )}
    </nav>
  );
}

export default AppNav;
