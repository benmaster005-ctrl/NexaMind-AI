"use server";

import { createClient } from "@/lib/supabase/server";
import { buildDocumentView, type DocumentView } from "@/lib/resources/view";
import { listSearchHistory } from "@/lib/search/history-store";
import type { SearchHistoryItem } from "@/lib/search/history";

export interface ResourceData {
  id: string;
  title: string;
  category: string;
  status: string;
  storage_path: string | null;
  created_by: string | null;
  created_at: string;
  tags: string[] | null;
  chunk_count: number | null;
  error_message: string | null;
}

export interface DocumentDetailResult {
  success: boolean;
  resource: ResourceData | null;
  view: DocumentView | null;
  message?: string;
}

/**
 * Charge un document et ses morceaux textuels réels (depuis document_chunks).
 * Sécurisé via RLS Supabase (session requise).
 */
export async function getDocumentDetailAction(
  resourceId: string,
  targetChunkId?: string,
): Promise<DocumentDetailResult> {
  if (!resourceId) {
    return { success: false, resource: null, view: null, message: "Identifiant manquant." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, resource: null, view: null, message: "Non authentifié." };
    }

    const { data: resource, error: resError } = await supabase
      .from("resources")
      .select("id, title, category, status, storage_path, created_by, created_at, tags, chunk_count, error_message")
      .eq("id", resourceId)
      .maybeSingle();

    if (resError || !resource) {
      return { success: false, resource: null, view: null, message: "Document introuvable." };
    }

    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, content")
      .eq("resource_id", resourceId)
      .order("chunk_index", { ascending: true });

    if (chunksError) {
      return { success: false, resource: resource as ResourceData, view: null, message: "Impossible de lire le contenu." };
    }

    const view = buildDocumentView(chunks ?? [], { targetChunkId });

    return {
      success: true,
      resource: resource as ResourceData,
      view,
    };
  } catch {
    return { success: false, resource: null, view: null, message: "Erreur technique lors du chargement." };
  }
}

/**
 * Récupère l'historique récent de recherche de l'utilisateur.
 */
export async function getRecentSearchesAction(): Promise<SearchHistoryItem[]> {
  try {
    const supabase = await createClient();
    return await listSearchHistory({ client: supabase });
  } catch {
    return [];
  }
}
