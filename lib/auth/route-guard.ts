/**
 * Decision pure de garde de route (story 1.3, FR-3).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:guard`. Etant donnes l'etat de session
 * et le chemin demande, elle indique s'il faut laisser passer ou
 * rediriger, et vers ou.
 *
 * Evol. 2026-09-29 : gestion des roles SUPPRIMEE. Plus aucune route ne
 * verifie un role : tout utilisateur authentifie accede a tout, y compris
 * a /documents (depot et gestion du fonds documentaire partage).
 *
 * Regle R-1 du PRD (« Rien sans authentification ») : toute page de
 * l'application demande une session.
 */
export type GuardDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string };

/** Prefixes de pages qui exigent une session (dont `/documents`). */
const SESSION_REQUIRED_PREFIXES = [
  "/search",
  "/chat",
  "/history",
  "/resources",
  "/documents",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function decideRouteGuard(input: {
  pathname: string;
  hasSession: boolean;
}): GuardDecision {
  const { pathname, hasSession } = input;

  // Zones publiques : jamais bloquees (pages auth, API auth, assets).
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/")
  ) {
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