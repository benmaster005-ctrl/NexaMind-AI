/**
 * Lecture validée des variables d'environnement Supabase.
 *
 * Seules deux variables PUBLIQUES sont lues côté client (préfixe NEXT_PUBLIC_) :
 * - NEXT_PUBLIC_SUPABASE_URL : URL du projet Supabase.
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en repli)
 *   : clé publique anon/publishable — jamais de clé secrète ici (AD-4).
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const PUBLISHABLE_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export function getSupabaseEnv(): SupabaseEnv {
  const url = (process.env[URL_VAR] ?? "").trim();
  const anonKey = (
    process.env[ANON_VAR] ??
    process.env[PUBLISHABLE_VAR] ??
    ""
  ).trim();

  const missing: string[] = [];
  if (!url) missing.push(URL_VAR);
  if (!anonKey) missing.push(`${ANON_VAR} (ou ${PUBLISHABLE_VAR})`);

  if (missing.length > 0) {
    throw new Error(
      `[Supabase] Variables d'environnement manquantes : ${missing.join(", ")}. ` +
        `Copiez .env.example vers .env.local et renseignez-les.`,
    );
  }

  return { url, anonKey };
}
