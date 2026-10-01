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

export type IconName =
  | "home"
  | "search"
  | "chat"
  | "history"
  | "documents"
  | "upload"
  | "file"
  | "logout"
  | "send"
  | "close"
  | "arrow"
  | "sun"
  | "moon"
  | "chevronDown"
  | "chevronRight"
  | "plus"
  | "menu"
  | "user"
  | "sparkles"
  | "book"
  | "check"
  | "copy"
  | "trash"
  | "filter"
  | "sidebar"
  | "panelRight"
  | "arrowUp";

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
 * Onglets de l'en-tete horizontal du tableau de bord : les quatre sections de
 * travail, sans « Accueil ». La marque tient deja le role du retour a
 * l'accueil (elle pointe `/`), donc l'onglet ferait doublon. Meme source de
 * verite que la sidebar : on filtre, on ne reduplique pas.
 */
export function getTopNavItems(): NavItem[] {
  return getNavItems().filter((item) => item.href !== "/");
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

/**
 * Type de document deduit du chemin de stockage (refonte dashboard 2026-09-29).
 *
 * La table `resources` ne stocke ni extension ni taille : le nom de l'objet,
 * lui, conserve l'extension du fichier depose. On n'invente donc aucune
 * donnee — une extension inconnue rend simplement le libelle vide.
 */
const TYPE_LABELS: Record<string, string> = {
  ".pdf": "PDF",
  ".docx": "DOCX",
  ".txt": "TXT",
  ".md": "MD",
};

export function documentTypeLabel(storagePath: unknown): string {
  const path = String(storagePath ?? "").toLowerCase();
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return TYPE_LABELS[path.slice(dot)] ?? "";
}

/** Date courte francaise : « 28 sept. 2026 ». Chaine vide si date invalide. */
export function formatShortDate(isoDate: unknown): string {
  const target = new Date(String(isoDate ?? "")).getTime();
  if (Number.isNaN(target)) return "";
  return new Date(target).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Ecart en jours calendaires (et non en heures) entre deux instants locaux. */
function calendarDayGap(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const dayB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((dayA - dayB) / 86_400_000);
}

/**
 * Horodatage de l'historique : « Aujourd'hui · 09:42 », « Hier · 16:48 »,
 * « Lun. 26 sept. · 16:20 ». Chaine vide si la date est absente ou invalide —
 * on n'affiche jamais un horodatage invente.
 *
 * `nowMs` est injectable pour que le test ne depende pas de l'horloge.
 */
export function formatHistoryStamp(
  isoDate: unknown,
  nowMs: number = Date.now(),
): string {
  const target = new Date(String(isoDate ?? ""));
  const ms = target.getTime();
  if (Number.isNaN(ms)) return "";

  const time = target.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const gap = calendarDayGap(nowMs, ms);
  if (gap === 0) return `Aujourd'hui · ${time}`;
  if (gap === 1) return `Hier · ${time}`;

  const day = target.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  // fr-FR renvoie « lun. 26 sept. » : une puce de liste commence par une
  // majuscule, on capitalise donc la premiere lettre seulement.
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/**
 * Nom affiche du compte connecte : `prenom.nom@nexaworks.example` -> `Prenom N.`.
 * Aucune donnee inventee : le libelle est derive de l'adresse reelle.
 */
export function displayNameFromEmail(email: string): string {
  const [local = ""] = String(email ?? "").split("@");
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "Compte";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Deux premieres lettres du libelle, pour l'avatar (jamais d'image chargee). */
export function initialsFromName(name: string): string {
  const letters = String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .filter((letter) => /[A-Z]/.test(letter));
  if (letters.length === 0) return "NM";
  return letters.slice(0, 2).join("");
}
