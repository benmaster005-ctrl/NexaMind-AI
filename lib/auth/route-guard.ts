/**
 * Decision pure de garde de route (story 1.3, FR-3 ; durcie le 2026-09-27).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:guard`. Etant donnes l'etat de session
 * (utilisateur present ou non, role) et le chemin demande, elle indique
 * s'il faut laisser passer ou rediriger, et vers ou.
 *
 * Regle R-1 du PRD (« Rien sans authentification ») : toute page de
 * l'application demande une session. La validation MVP a detecte que
 * `/search`, `/chat` et `/history` repondaient 200 sans session (seules
 * `/` et `/admin/*` etaient gardees) : l'interface etait exposee, meme si
 * les donnees restaient protegees par la RLS.
 */
export type GuardDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string };

/** Prefixes de pages qui exigent une session (hors `/admin/*`, gere a part). */
const SESSION_REQUIRED_PREFIXES = [
  "/search",
  "/chat",
  "/history",
  "/resources",
];

function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function decideRouteGuard(input: {
  pathname: string;
  hasSession: boolean;
  role: unknown;
}): GuardDecision {
  const { pathname, hasSession, role } = input;

  // Zones publiques : jamais bloquees (pages auth, API auth, assets).
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/")
  ) {
    return { allowed: true };
  }

  // Zone d'administration : session requise, puis role 'admin' requis.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!hasSession) {
      return { allowed: false, redirectTo: "/login" };
    }
    if (normalizeRole(role) !== "admin") {
      return { allowed: false, redirectTo: "/" };
    }
    return { allowed: true };
  }

  // Accueil et pages applicatives : session requise (R-1).
  const needsSession =
    pathname === "/" || SESSION_REQUIRED_PREFIXES.some((p) => matchesPrefix(pathname, p));
  if (needsSession && !hasSession) {
    return { allowed: false, redirectTo: "/login" };
  }
  if (needsSession) {
    return { allowed: true };
  }

  // Routes techniques (/_next, /favicon.ico, /_not-found) : laisser passer.
  return { allowed: true };
}