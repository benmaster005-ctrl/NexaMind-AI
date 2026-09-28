/**
 * Client Supabase pour le code serveur UNIQUEMENT
 * (Server Components, Route Handlers, Server Actions).
 *
 * INTERDIT dans les Client Components : ce fichier utilise `next/headers`
 * (cookies) et ne doit jamais être importé côté navigateur.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : l'écriture des cookies
          // est gérée par le middleware de rafraîchissement de session.
        }
      },
    },
  });
}
