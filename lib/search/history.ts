/**
 * Helpers purs de l'historique des recherches (story 5.3, FR-16).
 *
 * Module sans dependance (ni Next, ni Supabase) : les regles
 * d'enregistrement, de deduplication, de tri et de formatage sont testables
 * hors reseau via `npm run test:search-history`.
 */

export interface SearchHistoryItem {
  id: string;
  /** Texte exact de la requete, tel que saisi par l'utilisateur. */
  query: string;
  /** Nombre de resultats de la recherche reellement executee. */
  resultCount: number;
  /** ISO 8601 : formate ensuite par `formatRelativeDate`. */
  createdAt: string;
}

/** Nombre d'entrees affichees au maximum (story 5.3). */
export const SEARCH_HISTORY_LIMIT = 10;

/** Longueur maximale d'une requete enregistrable (borne de la route). */
export const MAX_RECORDED_QUERY = 500;

export const SEARCH_HISTORY_MESSAGES = {
  empty: "Vos recherches recentes apparaitront ici.",
  delete: "Supprimer cette recherche de l'historique",
  replay: "Rejouer cette recherche",
} as const;

/**
 * Normalise pour la comparaison (deduplication) : espaces internes
 * reduits, casse ignoree. La requete **enregistree** reste le texte brut.
 */
export function normalizeQuery(query: string): string {
  return String(query ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Une recherche est enregistrable si elle est exploitable et differente de la
 * derniere entree (le debounce du client relance la meme requete).
 */
export function shouldRecordSearch(lastQuery: unknown, nextQuery: unknown): boolean {
  const next = String(nextQuery ?? "").trim();
  if (!next || next.length > MAX_RECORDED_QUERY) return false;
  const last = normalizeQuery(lastQuery as string);
  return last !== normalizeQuery(next);
}

/** Ligne `search_history` brute depuis la base. */
export interface SearchHistoryRow {
  id: string;
  query: string;
  result_count?: number | null;
  created_at?: string | null;
}

/**
 * Lignes DB -> entrees d'historique : validation, tri decroissant, plafond
 * `SEARCH_HISTORY_LIMIT`. Pur.
 */
export function buildSearchHistoryItems(rows: unknown): SearchHistoryItem[] {
  if (!Array.isArray(rows)) return [];
  const valid: Array<{ item: SearchHistoryItem; timestamp: number }> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as SearchHistoryRow;
    if (typeof r.id !== "string" || !r.id) continue;
    const query = typeof r.query === "string" ? r.query.trim() : "";
    if (!query) continue;
    const createdAt = typeof r.created_at === "string" ? r.created_at : "";
    const parsed = Date.parse(createdAt);
    const count =
      typeof r.result_count === "number" && Number.isFinite(r.result_count)
        ? Math.max(0, Math.floor(r.result_count))
        : 0;
    valid.push({
      item: { id: r.id, query, resultCount: count, createdAt },
      // Une date invalide passe en fin de liste plutot que de casser le tri.
      timestamp: Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed,
    });
  }
  valid.sort((a, b) => b.timestamp - a.timestamp);
  return valid.slice(0, SEARCH_HISTORY_LIMIT).map((v) => v.item);
}

/** Libelle FR du nombre de resultats. */
export function formatResultCount(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return "Aucun résultat";
  return n === 1 ? "1 résultat" : `${n} résultats`;
}

/**
 * Entree a ajouter apres une recherche reussie (ajout optimiste cote client) :
 * dedoublonne en tete de liste, plafonne, et n'invente pas d'identifiant.
 */
export function prependSearchItem(
  items: SearchHistoryItem[],
  entry: { query: string; resultCount: number; createdAt?: string },
): SearchHistoryItem[] {
  const query = String(entry.query ?? "").trim();
  if (!query) return items;
  const normalized = normalizeQuery(query);
  const withoutDuplicate = items.filter((i) => normalizeQuery(i.query) !== normalized);
  const created: SearchHistoryItem = {
    id: `pending-${normalized.replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    query,
    resultCount:
      Number.isFinite(entry.resultCount) && entry.resultCount > 0
        ? Math.floor(entry.resultCount)
        : 0,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  return [created, ...withoutDuplicate].slice(0, SEARCH_HISTORY_LIMIT);
}

/** Retire une entree de la liste (apres suppression reussie). */
export function removeSearchItem(
  items: SearchHistoryItem[],
  id: string,
): SearchHistoryItem[] {
  return items.filter((i) => i.id !== id);
}
