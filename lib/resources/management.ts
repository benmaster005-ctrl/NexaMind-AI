/**
 * Gestion des ressources existantes (story 2.4, FR-5/FR-7).
 * Logique pure testable sans reseau : les Server Actions injectent
 * le client Supabase reel, les tests injectent un faux client.
 * - Role `admin` verifie cote serveur avant toute ecriture (AD-2).
 * - MAJ limitee aux metadonnees (categorie + tags), sans re-ingestion.
 * - Suppression : ligne `resources` d'abord (cascade pgvector via
 *   `on delete cascade`), puis objet Storage.
 */
import { normalizeTags, validateCategory } from "./validation.ts";

export const MSG_FORBIDDEN = "Accès réservé aux administrateurs.";
export const MSG_NETWORK = "Problème de connexion. Vérifiez votre réseau et réessayez.";
export const MSG_METADATA_SAVED = "Métadonnées mises à jour.";
export const MSG_DELETED = "Ressource supprimée définitivement.";
export const MSG_DELETED_PARTIAL = "Ressource supprimée de la base, mais le fichier distant n'a pas pu être retiré : contactez le support.";
export const MSG_NOT_FOUND = "Ressource introuvable : rechargez la liste.";

export interface ManagementResult {
  success: boolean;
  message: string;
}

export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.trim().toLowerCase() === "admin";
}

export interface ManagementClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{
        error: { message: string } | null;
      }>;
    };
  };
}

export interface UpdateMetadataInput {
  client: ManagementClient;
  role: unknown;
  resourceId: string;
  category: string;
  tags: unknown;
}

export interface DeleteResourceInput {
  client: ManagementClient;
  role: unknown;
  resourceId: string;
  bucket?: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function errMsg(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message ?? "");
  }
  return "";
}

/** MAJ categorie + tags. Ne touche ni au Storage ni aux vecteurs. */
export async function updateResourceMetadata({
  client,
  role,
  resourceId,
  category,
  tags,
}: UpdateMetadataInput): Promise<ManagementResult> {
  if (!isAdminRole(role)) return { success: false, message: MSG_FORBIDDEN };
  if (!isUuid(resourceId)) return { success: false, message: MSG_NOT_FOUND };
  const check = validateCategory(category);
  if (!check.valid) return { success: false, message: check.message ?? MSG_NETWORK };
  try {
    const { error } = await client
      .from("resources")
      .update({ category, tags: normalizeTags(tags) })
      .eq("id", resourceId);
    if (error) return { success: false, message: MSG_NETWORK };
  } catch {
    return { success: false, message: MSG_NETWORK };
  }
  return { success: true, message: MSG_METADATA_SAVED };
}

/**
 * Suppression : lecture du storage_path, delete DB (cascade pgvector),
 * puis retrait Storage. Si le Storage echoue apres la DB, la base reste
 * coherente (plus aucun chunk citable) avec un message dedie.
 */
export async function deleteResource({
  client,
  role,
  resourceId,
  bucket = "documents",
}: DeleteResourceInput): Promise<ManagementResult> {
  if (!isAdminRole(role)) return { success: false, message: MSG_FORBIDDEN };
  if (!isUuid(resourceId)) return { success: false, message: MSG_NOT_FOUND };
  let storagePath = "";
  try {
    const { data, error } = await client
      .from("resources")
      .select("storage_path")
      .eq("id", resourceId)
      .maybeSingle();
    if (error) return { success: false, message: MSG_NETWORK };
    if (typeof data?.storage_path !== "string" || !data.storage_path) {
      return { success: false, message: MSG_NOT_FOUND };
    }
    storagePath = data.storage_path;
  } catch {
    return { success: false, message: MSG_NETWORK };
  }
  try {
    const { error } = await client.from("resources").delete().eq("id", resourceId);
    if (error) {
      if (/row-level security|permission denied|policy/i.test(errMsg(error))) {
        return { success: false, message: MSG_FORBIDDEN };
      }
      return { success: false, message: MSG_NETWORK };
    }
  } catch {
    return { success: false, message: MSG_NETWORK };
  }
  try {
    const { error } = await client.storage.from(bucket).remove([storagePath]);
    if (error) return { success: true, message: MSG_DELETED_PARTIAL };
  } catch {
    return { success: true, message: MSG_DELETED_PARTIAL };
  }
  return { success: true, message: MSG_DELETED };
}
