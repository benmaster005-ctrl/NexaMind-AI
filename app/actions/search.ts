"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { deleteSearchEntry, clearSearchHistory } from "@/lib/search/history-store";

export interface DeleteSearchHistoryResult {
  success: boolean;
  message: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MSG_INVALID = "Cette recherche n'existe pas ou a deja ete supprimee.";

export async function deleteSearchHistoryAction(
  id: string,
): Promise<DeleteSearchHistoryResult> {
  const entryId = String(id ?? "").trim();
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

    revalidatePath("/");
    return { success: true, message: "" };
  } catch {
    return { success: false, message: MSG_INVALID };
  }
}

export async function clearAllSearchHistoryAction(): Promise<DeleteSearchHistoryResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: MSG_INVALID };

    const cleared = await clearSearchHistory({ client: supabase });
    if (!cleared) return { success: false, message: "Impossible de supprimer l'historique." };

    revalidatePath("/");
    return { success: true, message: "" };
  } catch {
    return { success: false, message: "Erreur technique lors de la suppression." };
  }
}
