/**
 * Client Supabase pour les composants navigateur (Client Components).
 * INTERDIT côté serveur : utilisez `lib/supabase/server.ts` dans les
 * Server Components, Route Handlers et Server Actions.
 */
import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
