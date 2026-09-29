/**
 * Helpers purs du tableau de bord (story 1.4, FR-4).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:dashboard`.
 *
 * Evol. 2026-09-29 : gestion des roles SUPPRIMEE. Tous les utilisateurs
 * authentifies peuvent deposer/gerer des documents. La navigation est
 * donc unique (plus de variante admin / collaborateur).
 */

export type IconName = "home" | "search" | "chat" | "history" | "documents";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * Navigation unique, identique pour tous les utilisateurs authentifies :
 * [Accueil, Recherche, Assistant, Historique, Documents].
 */
export function getNavItems(): NavItem[] {
  return [
    { href: "/", label: "Accueil", icon: "home" },
    { href: "/search", label: "Recherche", icon: "search" },
    { href: "/chat", label: "Assistant", icon: "chat" },
    { href: "/history", label: "Historique", icon: "history" },
    { href: "/documents", label: "Documents", icon: "documents" },
  ];
}

/**
 * Onglet actif (story 7.1) : match exact, ou par section pour les vues
 * imbriquees (`/chat/<id>` active l'onglet `/chat`, mais `/` reste exact).
 */
export function isNavItemActive(itemHref: string, activeHref: string): boolean {
  if (itemHref === activeHref) return true;
  if (itemHref === "/") return false;
  return activeHref.startsWith(`${itemHref}/`);
}

/**
 * Date relative en francais pour la reprise d'activite
 * (EXPERIENCE.md ecran 2 : "Il y a 2h").
 */
export function formatRelativeDate(
  isoDate: string,
  nowMs: number = Date.now(),
): string {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return "Date inconnue";
  const diffMs = nowMs - target;
  if (diffMs < 0) return "À venir";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  const date = new Date(target);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date(nowMs).getFullYear() ? undefined : "numeric",
  });
}