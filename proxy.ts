import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de session (ex-`middleware.ts`).
 *
 * Next.js 16 a renomme la convention `middleware` en `proxy` : le fichier
 * racine s'appelle donc `proxy.ts` et la fonction exportee `proxy`. Le
 * module partage `lib/supabase/middleware.ts` garde son nom (c'est un module
 * interne, pas une convention de fichier Next) et reste audite par
 * `scripts/security.test.ts`.
 *
 * Runtime : depuis Next 16 le proxy execute par defaut sur le runtime Node,
 * ce qui convient a `@supabase/ssr` (lecture/écriture des cookies de session).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

/**
 * Matcher : tout sauf les assets statiques et les fichiers images.
 * Sans exclusion, le proxy tournerait sur `_next/static` et `_next/image`
 * et ralentirait (ou bloquerait) le chargement des feuilles de style du socle.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
