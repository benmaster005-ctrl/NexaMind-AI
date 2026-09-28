/**
 * Navigation principale du socle (story 7.1).
 *
 * Remplace le bloc `<nav>` qui etait recopie dans les 7 pages (avec, pour
 * l'accueil, une seconde copie des styles). Composant sans etat : la page
 * indique son propre onglet via `active`, donc aucun JavaScript cote client.
 */
import Link from "next/link";

import type { NavItem } from "@/lib/dashboard/helpers";
import { isNavItemActive } from "@/lib/dashboard/helpers";
import { Icon } from "./icon";
import styles from "./ui.module.css";

interface AppNavProps {
  items: NavItem[];
  /** Href de la page courante (ou de sa section) pour marquer l'onglet actif. */
  active: string;
}

export function AppNav({ items, active }: AppNavProps) {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {items.map((item) => {
        const isActive = isNavItemActive(item.href, active);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.navItem, isActive ? styles.navItemActive : ""]
              .filter(Boolean)
              .join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={item.icon} className={styles.navIcon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default AppNav;
