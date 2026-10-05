import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  MAX_QUERY_LENGTH,
  clampLimit,
  clampThreshold,
  realEmbedQuery,
  searchDocuments,
  SEARCH_MESSAGES,
  type SemanticHit,
  type TextHit,
} from "@/lib/ai/search";
import { recordSearch } from "@/lib/search/history-store";
const MSG_UNAUTHORIZED = "Connectez-vous pour rechercher.";
const MSG_TOO_LONG =
  "Requête trop longue : 500 caractères maximum.";
const MSG_UPSTREAM =
  "Recherche temporairement indisponible. Vérifiez votre connexion et réessayez.";

/**
 * Budget d'exécution (préparation déploiement Vercel) : l'embedding de la
 * requête appelle l'API Gemini avant la recherche vectorielle. Plafond
 * explicite et portable : le défaut de la plateforme varie selon la cible
 * (300 s sous Fluid Compute, 60 s sur le plan Hobby avant Fluid Compute).
 * 30 s laissent la marge nécessaire sans immobiliser une instance.
 */
export const maxDuration = 30;

function errMsg(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message ?? "");
  }
  return String(error ?? "");
}

/**
 * GET /api/search?q=&limit=&threshold=&category=
 * 200 `{ results: [...] }`, 401 sans session, 400 q trop longue,
 * requete vide -> `{ results: [] }` sans appel IA.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: MSG_UNAUTHORIZED }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = clampLimit(searchParams.get("limit"));
  const threshold = clampThreshold(searchParams.get("threshold"));
  const categoryParam = searchParams.get("category") ?? undefined;
  const category =
    categoryParam && categoryParam.trim() ? categoryParam.trim() : undefined;

  if (q.trim() && q.trim().length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: MSG_TOO_LONG }, { status: 400 });
  }
  if (!q.trim() || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const outcome = await searchDocuments({
    query: q,
    limit,
    threshold,
    category,
    deps: supabaseSearchDeps(supabase),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.message || MSG_UPSTREAM, results: [] },
      { status: 502 },
    );
  }
  // 5.3 (FR-16) : enregistrement best effort de la recherche reussie.
  // Le seul point de capture, avec la requete exacte et le nombre REEL de
  // resultats renvoyes. `recordSearch` ne leve jamais : si la migration 0007
  // n'est pas jouee, la recherche fonctionne normalement (matrice I/O).
  await recordSearch({
    client: supabase,
    userId: user.id,
    query: q,
    resultCount: outcome.results.length,
  });

  return NextResponse.json({
    results: outcome.results,
    degraded: outcome.degraded || undefined,
    message: outcome.message || undefined,
  });
}
/** Adaptateur reel Supabase : RPC + recherche texte. */
export function supabaseSearchDeps(supabase: SupabaseClient) {
  return {
    embedQuery: realEmbedQuery,
    runSemantic: async ({
      embedding,
      threshold,
      limit,
      category,
    }: {
      embedding: number[];
      threshold: number;
      limit: number;
      category?: string;
    }): Promise<SemanticHit[]> => {
      const { data, error } = await supabase.rpc("match_chunks", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as SemanticHit[];
      if (category) rows = rows.filter((r) => r.category === category);
      return rows;
    },
    runText: async ({
      query,
      limit,
      category,
    }: {
      query: string;
      limit: number;
      category?: string;
    }): Promise<TextHit[]> => {
      // Échappement des jokers SQL saisis par l'utilisateur (% et _) ; nos
      // propres % restent autour du motif.
      const pattern = `%${query.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      const base = () => {
        let b = supabase
          .from("resources")
          .select("id, title, category, created_at, tags")
          .eq("status", "Prête");
        if (category) b = b.eq("category", category);
        return b;
      };
      // Deux ilike séparés (titres puis catégories) : un filtre .or() construit
      // à la main casse sur les virgules/apostrophes/guillemets de la question
      // utilisateur (PostgREST « failed to parse logic tree »), alors que des
      // paramètres ilike simples sont encodés en URL sans arbre à parser.
      const [byTitle, byCategory] = await Promise.all([
        base()
          .ilike("title", pattern)
          .order("created_at", { ascending: false })
          .limit(limit),
        base()
          .ilike("category", pattern)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);
      if (byTitle.error) throw new Error(errMsg(byTitle.error));
      if (byCategory.error) throw new Error(errMsg(byCategory.error));
      type Row = {
        id: string;
        title: string;
        category: string;
        created_at: string;
        tags: string[] | null;
      };
      // Dédoublonnage par id (une ressource peut matcher titre + catégorie).
      const seen = new Set<string>();
      const rows = [
        ...((byTitle.data ?? []) as Row[]),
        ...((byCategory.data ?? []) as Row[]),
      ]
        .filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        })
        .slice(0, limit);
      return rows.map((r) => ({
        resource_id: r.id,
        title: r.title ?? "",
        category: r.category ?? "",
        created_at: r.created_at ?? "",
        excerpt: r.title ?? "",
      }));
    },
  };
}

export { SEARCH_MESSAGES };
