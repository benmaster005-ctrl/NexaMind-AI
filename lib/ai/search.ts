/**
 * Service de recherche hybride (story 3.2, FR-8/FR-9).
 * Semantique (embedding + RPC match_chunks) + texte (titre/tags).
 * Testable sans reseau : acces externes injectes via `SearchDeps`.
 */
import { generateEmbeddings } from "./embeddings.ts";

/** Seuil d'abstention / similarite par defaut (AD-1). */
export const DEFAULT_SEARCH_THRESHOLD = 0.65;
export const DEFAULT_SEARCH_LIMIT = 10;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 50;
export const MAX_QUERY_LENGTH = 500;

export type MatchKind = "semantic" | "text";

export interface SemanticHit {
  chunk_id: string;
  resource_id: string;
  title: string;
  category: string;
  created_at: string;
  content: string;
  similarity: number;
}

export interface TextHit {
  resource_id: string;
  title: string;
  category: string;
  created_at: string;
  excerpt: string;
}

export interface SearchResult {
  resourceId: string;
  chunkId: string | null;
  title: string;
  category: string;
  createdAt: string;
  excerpt: string;
  similarity: number | null;
  matchKind: MatchKind;
}

export interface SearchDeps {
  embedQuery: (query: string) => Promise<number[]>;
  runSemantic: (input: {
    embedding: number[];
    threshold: number;
    limit: number;
    category?: string;
  }) => Promise<SemanticHit[]>;
  runText: (input: {
    query: string;
    limit: number;
    category?: string;
  }) => Promise<TextHit[]>;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  category?: string;
  deps: SearchDeps;
}

export interface SearchOutcome {
  ok: boolean;
  results: SearchResult[];
  message: string;
  degraded: boolean;
}

export const SEARCH_MESSAGES = {
  embeddingFallback:
    "Recherche sémantique indisponible, résultats textuels seuls.",
  globalFailure:
    "Recherche temporairement indisponible. Vérifiez votre connexion et réessayez.",
} as const;

/**
 * `null` (parametre absent), `undefined` et la chaine vide doivent donner la
 * valeur par defaut. Sans cette garde, `Number(null)` vaut 0 : le seuil
 * tombait a 0 (tout remontait, y compris du bruit a 0.5) et la limite a 1
 * resultat. Detecte par la validation MVP du 2026-09-27.
 */
function toNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function clampLimit(raw: unknown): number {
  const n = toNumberOrNull(raw);
  if (n === null) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(MIN_SEARCH_LIMIT, Math.floor(n)));
}

export function clampThreshold(raw: unknown): number {
  const n = toNumberOrNull(raw);
  if (n === null) return DEFAULT_SEARCH_THRESHOLD;
  return Math.min(1, Math.max(0, n));
}

function normalizeCategory(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}
/** Suite de searchDocuments : fusion hybride + repli degrade. */
export async function searchDocuments(
  options: SearchOptions,
): Promise<SearchOutcome> {
  const query = (options.query ?? "").trim();
  if (!query) {
    return { ok: true, results: [], message: "", degraded: false };
  }
  const limit = clampLimit(options.limit ?? DEFAULT_SEARCH_LIMIT);
  const threshold = clampThreshold(options.threshold ?? DEFAULT_SEARCH_THRESHOLD);
  const category = normalizeCategory(options.category);

  let semanticHits: SemanticHit[] = [];
  let semanticFailed = false;
  try {
    const embedding = await options.deps.embedQuery(query);
    if (!Array.isArray(embedding) || embedding.length === 0) {
      semanticFailed = true;
    } else {
      semanticHits = await options.deps.runSemantic({
        embedding,
        threshold,
        limit,
        category,
      });
    }
  } catch {
    semanticFailed = true;
    semanticHits = [];
  }

  let textHits: TextHit[] = [];
  let textFailed = false;
  try {
    textHits = await options.deps.runText({ query, limit, category });
  } catch {
    textFailed = true;
    textHits = [];
  }

  if (semanticFailed && textFailed) {
    return {
      ok: false,
      results: [],
      message: SEARCH_MESSAGES.globalFailure,
      degraded: false,
    };
  }

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const safeSemantic = Array.isArray(semanticHits) ? semanticHits : [];
  for (const hit of safeSemantic) {
    if (!hit || !hit.resource_id) continue;
    if (category && hit.category !== category) continue;
    if (seen.has(hit.resource_id)) continue;
    seen.add(hit.resource_id);
    results.push({
      resourceId: hit.resource_id,
      chunkId: hit.chunk_id ?? null,
      title: hit.title ?? "",
      category: hit.category ?? "",
      createdAt: hit.created_at ?? "",
      excerpt: hit.content ?? "",
      similarity: typeof hit.similarity === "number" ? hit.similarity : null,
      matchKind: "semantic",
    });
    if (results.length >= limit) break;
  }

  if (results.length < limit) {
    const safeText = Array.isArray(textHits) ? textHits : [];
    for (const hit of safeText) {
      if (!hit || !hit.resource_id) continue;
      if (category && hit.category !== category) continue;
      if (seen.has(hit.resource_id)) continue;
      seen.add(hit.resource_id);
      results.push({
        resourceId: hit.resource_id,
        chunkId: null,
        title: hit.title ?? "",
        category: hit.category ?? "",
        createdAt: hit.created_at ?? "",
        excerpt: hit.excerpt ?? hit.title ?? "",
        similarity: null,
        matchKind: "text",
      });
      if (results.length >= limit) break;
    }
  }

  return {
    ok: true,
    results,
    message: semanticFailed ? SEARCH_MESSAGES.embeddingFallback : "",
    degraded: semanticFailed,
  };
}

/** Adaptateur reel : vectorise via Gemini (voir EMBEDDING_MODEL, 768d). */
export async function realEmbedQuery(query: string): Promise<number[]> {
  const vectors = await generateEmbeddings({ texts: [query] });
  return vectors[0] ?? [];
}
