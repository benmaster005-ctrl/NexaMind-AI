import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSearchHistory } from "@/lib/search/history-store";
import { buildDocumentView } from "@/lib/resources/view";
import WorkspaceShell from "@/components/workspace/workspace-shell";
import type { ResourceData } from "@/app/actions/workspace";

export const metadata: Metadata = {
  title: "NexaMind AI — Knowledge Workspace",
  description:
    "Le knowledge workspace intelligent de l'entreprise : consultez, lisez et interrogez vos connaissances documentaires.",
};

/**
 * Workspace NexaMind AI — Refonte Complète.
 *
 * Architecture 3 colonnes :
 * - Header : Logo, recherche globale, assistant, theme, profil
 * - Catégories : Toutes | Ressources | Projets | Procédures | FAQ | ...
 * - Colonne gauche : Bibliothèque documentaire (Mes ressources / Ressources de l'entreprise)
 * - Centre : Document Reader (contenu réel des morceaux indexés) + Assistant fixé en bas
 * - Colonne droite : Historique ou Assistant Conversationnel (RAG)
 *
 * Aucune fausse donnée : toutes les lectures proviennent de la base de données via RLS.
 */
export default async function WorkspaceHome({
  searchParams,
}: {
  searchParams?: Promise<{ doc?: string; chunk?: string; category?: string; q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Documents réels
  let resources: ResourceData[] = [];
  try {
    const { data, error } = await supabase
      .from("resources")
      .select("id, title, category, status, storage_path, created_by, created_at, tags, chunk_count, error_message")
      .order("created_at", { ascending: false });
    if (!error && data) {
      resources = data as ResourceData[];
    }
  } catch {
    resources = [];
  }

  // 2. Document sélectionné initialement
  let selectedDoc: ResourceData | null = null;
  let initialDocumentView = null;
  const initialDocId = typeof params.doc === "string" ? params.doc.trim() : "";
  const initialChunkId = typeof params.chunk === "string" ? params.chunk.trim() : undefined;

  if (initialDocId) {
    selectedDoc = resources.find((r) => r.id === initialDocId) ?? null;
  }
  if (!selectedDoc && resources.length > 0) {
    selectedDoc = resources[0];
  }

  // Lecture des morceaux réels du document sélectionné
  if (selectedDoc) {
    try {
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("id, chunk_index, content")
        .eq("resource_id", selectedDoc.id)
        .order("chunk_index", { ascending: true });
      if (chunks) {
        initialDocumentView = buildDocumentView(chunks, { targetChunkId: initialChunkId });
      }
    } catch {
      initialDocumentView = null;
    }
  }

  // 3. Historique de recherche réel
  let searches: Awaited<ReturnType<typeof listSearchHistory>> = [];
  try {
    searches = await listSearchHistory({ client: supabase });
  } catch {
    searches = [];
  }

  // 4. Conversations passées réelles
  let conversations: Array<{ id: string; title: string; created_at: string }> = [];
  try {
    const { data: convRows } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    conversations = (convRows ?? []) as Array<{ id: string; title: string; created_at: string }>;
  } catch {
    conversations = [];
  }

  const initialCategory = typeof params.category === "string" && params.category.trim() ? params.category.trim() : "Toutes";
  const initialQuery = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <WorkspaceShell
      initialUserEmail={user.email ?? ""}
      currentUserId={user.id}
      initialDocuments={resources}
      initialSelectedDoc={selectedDoc}
      initialDocumentView={initialDocumentView}
      initialSearches={searches}
      initialConversations={conversations}
      initialCategory={initialCategory}
      initialQuery={initialQuery}
    />
  );
}
