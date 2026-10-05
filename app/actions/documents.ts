"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ingestResource, supabaseIngestDeps } from "@/lib/ingestion/ingest-resource";
import {
  deleteResource,
  updateResourceMetadata,
  type ManagementResult,
} from "@/lib/resources/management";
import {
  validatePresence,
  validateFormat,
  validateSize,
  validateCategory,
  validateTitle,
  normalizeTags,
} from "@/lib/resources/validation";

export interface UploadActionResult {
  success: boolean;
  /** Message FR à afficher (succès ou erreur). */
  message: string;
}

const MSG_BUCKET_MISSING =
  "Stockage non configuré : jouez la migration 0002_storage_resources.sql dans Supabase > SQL Editor > Run.";
const MSG_NETWORK =
  "Problème de connexion. Vérifiez votre réseau et réessayez.";
const MSG_SAVED = "Document déposé et indexé avec succès.";
const MSG_INGESTION_FAILED = "Document déposé, mais l'indexation a échoué :";
const MSG_INGESTION_ERROR =
  "Document déposé, mais l'ingestion n'a pas pu être terminée (erreur technique inattendue).";

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * Dépôt documentaire ouvert à tout utilisateur authentifié.
 * Valide le fichier (format, 4 Mo — `MAX_UPLOAD_BYTES`), l'envoie au
 * bucket privé `documents`, puis insère la ressource en statut 'En cours'.
 */
export async function uploadResourceAction(
  formData: FormData,
): Promise<UploadActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Connectez-vous pour déposer un document." };
  }

  const title = String(formData.get("title") ?? "");
  const category = String(formData.get("category") ?? "");
  const tags = normalizeTags(formData.get("tags"));
  const file = formData.get("file");

  const titleCheck = validateTitle(title);
  if (!titleCheck.valid) {
    return { success: false, message: titleCheck.message ?? MSG_SAVED };
  }
  const categoryCheck = validateCategory(category);
  if (!categoryCheck.valid) {
    return { success: false, message: categoryCheck.message ?? MSG_SAVED };
  }
  const presenceCheck = validatePresence(file);
  if (!presenceCheck.valid || !(file instanceof File)) {
    return { success: false, message: presenceCheck.message ?? MSG_SAVED };
  }
  const formatCheck = validateFormat(file.name, file.type);
  if (!formatCheck.valid) {
    return { success: false, message: formatCheck.message ?? MSG_SAVED };
  }
  const sizeCheck = validateSize(file.size);
  if (!sizeCheck.valid) {
    return { success: false, message: sizeCheck.message ?? MSG_SAVED };
  }

  const storagePath = `${user.id}/${randomUUID()}${getExtension(file.name)}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      if (/bucket not found|bucket_not_found|not found/i.test(uploadError.message)) {
        return { success: false, message: MSG_BUCKET_MISSING };
      }
      return { success: false, message: MSG_NETWORK };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("resources")
      .insert({
        title: title.trim(),
        category,
        tags,
        status: "En cours",
        storage_path: storagePath,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      await supabase.storage.from("documents").remove([storagePath]);
      return { success: false, message: MSG_NETWORK };
    }

    revalidatePath("/");

    const resourceId = String(inserted.id);
    try {
      const ingestion = await ingestResource({
        resourceId,
        deps: supabaseIngestDeps({
          supabase,
          resourceId,
          title: title.trim(),
          storagePath,
        }),
      });
      return {
        success: true,
        message: ingestion.ok
          ? `${MSG_SAVED} ${ingestion.chunkCount} morceau(x) vectorisé(s).`
          : `${MSG_INGESTION_FAILED} ${ingestion.message}`,
      };
    } catch {
      return { success: true, message: MSG_INGESTION_ERROR };
    }
  } catch {
    return { success: false, message: MSG_NETWORK };
  }
}

/**
 * Mise à jour des métadonnées d'un document.
 * Ouvert à tout utilisateur authentifié.
 */
export async function updateResourceMetadataAction(
  resourceId: string,
  category: string,
  tags: string,
): Promise<ManagementResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Connectez-vous pour modifier un document." };
  }
  const result = await updateResourceMetadata({
    client: supabase,
    resourceId,
    category,
    tags,
  });
  if (result.success) revalidatePath("/");
  return result;
}

/**
 * Suppression avec déréférencement d'un document.
 * Ouvert à tout utilisateur authentifié.
 */
export async function deleteResourceAction(
  resourceId: string,
): Promise<ManagementResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Connectez-vous pour supprimer un document." };
  }
  const result = await deleteResource({
    client: supabase,
    resourceId,
  });
  if (result.success) revalidatePath("/");
  return result;
}
