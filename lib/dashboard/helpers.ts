/**
 * Helpers purs du tableau de bord (story 1.4, FR-4).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:dashboard`.
 */

export type UserRole = "admin" | "collaborateur";

/** Icones disponibles du socle (components/ui/icon.tsx). */
export type IconName = "home" | "search" | "chat" | "history" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  adminOnly: boolean;
}

/**
 * Normalise le role lu depuis **app_metadata** (defaut collaborateur).
 *
 * ⚠ Securite : le role ne doit JAMAIS etre lu dans `user_metadata`, que
 * l'utilisateur peut modifier lui-meme (auth.updateUser). Seul `app_metadata`
 * est ecrit par le serveur (trigger d'inscription, migration 0008).
 */
export function normalizeUserRole(role: unknown): UserRole {
  return typeof role === "string" && role.trim().toLowerCase() === "admin"
    ? "admin"
    : "collaborateur";
}

/**
 * Navigation EXPERIENCE.md §1 : 4 onglets, le 4e depend du role.
 * - Collaborateur : [Accueil, Recherche, Assistant, Historique]
 * - Admin : [Accueil, Recherche, Assistant, Gerer]
 */
export function getNavItems(role: UserRole): NavItem[] {
  const items: NavItem[] = [
    { href: "/", label: "Accueil", icon: "home", adminOnly: false },
    { href: "/search", label: "Recherche", icon: "search", adminOnly: false },
    { href: "/chat", label: "Assistant", icon: "chat", adminOnly: false },
  ];
  if (role === "admin") {
    items.push({
      href: "/admin/resources",
      label: "Gérer",
      icon: "admin",
      adminOnly: true,
    });
  } else {
    items.push({
      href: "/history",
      label: "Historique",
      icon: "history",
      adminOnly: false,
    });
  }
  return items;
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