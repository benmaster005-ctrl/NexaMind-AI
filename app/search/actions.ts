"use server";

/**
 * Suppression d'une entree de l'historique des recherches (story 5.3, FR-16).
 *
 * Partagee par les deux ecrans (`/search` et `/history`). La suppression est
 * filtree par la RLS : un utilisateur ne peut supprimer que ses propres
 * entrees, meme en forgeant un id.
 */
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { deleteSearchEntry } from "@/lib/search/history-store";

export interface DeleteSearchHistoryResult {
  success: boolean;
  /** Message FR a afficher en cas d'echec. */
  message: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MSG_INVALID = "Cette recherche n'existe pas ou a deja ete supprimee.";

export async function deleteSearchHistoryAction(
  id: string,
): Promise<DeleteSearchHistoryResult> {
  const entryId = String(id ?? "").trim();
  // Les identifiants optimistes (ajout non encore persiste) sont ignores ici :
  // l'entree correspondante disparait de toute facon de l'etat local.
  if (!UUID_RE.test(entryId)) {
    return { success: true, message: "" };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: MSG_INVALID };

    const deleted = await deleteSearchEntry({ client: supabase, id: entryId });
    if (!deleted) return { success: false, message: MSG_INVALID };

    revalidatePath("/search");
    revalidatePath("/history");
    return { success: true, message: "" };
  } catch {
    return { success: false, message: MSG_INVALID };
  }
}
