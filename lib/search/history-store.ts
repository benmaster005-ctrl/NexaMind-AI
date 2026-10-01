/**
 * Acces Supabase a l'historique des recherches (story 5.3, FR-16).
 *
 * Le client est injecte (comme `lib/ingestion/ingest-resource.ts`) : aucune
 * fonction ne leve, tout renvoie un booleen ou une liste vide. Une table
 * absente (migration 0007 non jouee) doit degrader silencieusement, jamais
 * faire echouer une recherche.
 *
 * L'isolation est assuree par la RLS (`auth.uid() = owner_id`) : aucune
 * fonction ne recoit ni ne transmet d'owner_id de la requete.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SEARCH_HISTORY_LIMIT,
  buildSearchHistoryItems,
  shouldRecordSearch,
  type SearchHistoryItem,
} from "./history.ts";

/**
 * Client minimal utilise par le store. On reprend le type reellement fourni
 * par `@/lib/supabase/server` plutot qu'une interface structurelle : le
 * constructeur de requetes Supabase est fluently chainable et thenable, ce
 * qu'aucun type maison ne reproduit fidelement.
 */
export type SearchHistoryClient = Pick<SupabaseClient, "from">;

/** Entrees les plus recentes de l'utilisateur courant (RLS). */
export async function listSearchHistory(input: {
  client: SearchHistoryClient;
}): Promise<SearchHistoryItem[]> {
  try {
    const { data, error } = await input.client
      .from("search_history")
      .select("id, query, result_count, created_at")
      .order("created_at", { ascending: false })
      .limit(SEARCH_HISTORY_LIMIT);
    if (error || !data) return [];
    return buildSearchHistoryItems(data);
  } catch {
    return [];
  }
}

/**
 * Enregistre une recherche reussie (best effort).
 * Ne leve jamais et ne fait jamais echouer la recherche appelante.
 * Dedoublonne contre la derniere entree de l'utilisateur.
 */
export async function recordSearch(input: {
  client: SearchHistoryClient;
  userId: string;
  query: string;
  resultCount: number;
}): Promise<boolean> {
  const query = String(input.query ?? "").trim();
  if (!input.userId || !query) return false;
  try {
    const { data: last, error: lastError } = await input.client
      .from("search_history")
      .select("query")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) return false;
    if (!shouldRecordSearch(last?.query, query)) return false;

    const { error: insertError } = await input.client.from("search_history").insert({
      owner_id: input.userId,
      query,
      result_count:
        Number.isFinite(input.resultCount) && input.resultCount > 0
          ? Math.floor(input.resultCount)
          : 0,
    });
    return !insertError;
  } catch {
    return false;
  }
}

/** Supprime une entree (RLS : seul l'auteur y est autorise). */
export async function deleteSearchEntry(input: {
  client: SearchHistoryClient;
  id: string;
}): Promise<boolean> {
  const id = String(input.id ?? "").trim();
  if (!id) return false;
  try {
    const { error } = await input.client
      .from("search_history")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Supprime tout l'historique de recherche de l'utilisateur courant (RLS). */
export async function clearSearchHistory(input: {
  client: SearchHistoryClient;
}): Promise<boolean> {
  try {
    const { error } = await input.client
      .from("search_history")
      .delete()
      .not("id", "is", null);
    return !error;
  } catch {
    return false;
  }
}
