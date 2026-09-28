/**
 * Orchestration de l'ingestion documentaire (story 2.2, FR-6 / AD-3).
 *
 * Enchaînement : lecture du fichier brut (Storage) -> extraction du texte ->
 * découpage en morceaux de 400-500 tokens -> remplacement des morceaux de la
 * ressource. Un échec marque la ressource 'Échec' avec une raison lisible et
 * le succès la laisse 'En cours' avec `chunk_count` renseigné ('Prête'
 * appartient à la story 2.3, une fois les vecteurs calculés).
 *
 * Le service ne lève jamais : il retourne toujours un `IngestResult`.
 * Les dépendances sont injectées (lecture, écriture, extracteur, découpeur)
 * pour être testable sans réseau ni Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkDocument, type DocumentChunk } from "../ai/chunking.ts";
import {
  generateEmbeddings,
  EmbeddingError,
} from "../ai/embeddings.ts";
import {
  EXTRACTION_MESSAGES,
  extractText,
  ExtractionError,
  type ExtractionResult,
} from "../ai/extraction.ts";

export const INGESTION_BUCKET = "documents";

export interface ChunkWithEmbedding extends DocumentChunk {
  embedding?: number[];
}

export interface IngestResult {
  ok: boolean;
  /** Nombre de morceaux persistés (0 en cas d'échec). */
  chunkCount: number;
  /** Message FR de succès, ou raison d'échec persistée dans error_message. */
  message: string;
}

export interface IngestDeps {
  /** Titre du document, rappelé en tête de chaque morceau. */
  title: string;
  /** Nom du fichier déposé : choisit l'extracteur (.pdf, .docx, .txt, .md). */
  fileName: string;
  /** Lit le fichier brut (Storage). */
  readDocument: () => Promise<Uint8Array>;
  /** Remplace TOUS les morceaux de la ressource (idempotent). */
  replaceChunks: (chunks: ChunkWithEmbedding[]) => Promise<void>;
  /** Marque la ressource prête : 'Prête' + chunk_count. */
  markReady: (chunkCount: number) => Promise<void>;
  /** Repli : marquer chunked ('Prête' pour rétro-compatibilité). */
  markChunked?: (chunkCount: number) => Promise<void>;
  /** Marque la ressource en échec avec la raison FR. */
  markFailed: (reason: string) => Promise<void>;
  /** Extracteur remplaçable (tests). */
  extract?: typeof extractText;
  /** Découpeur remplaçable (tests). */
  chunk?: typeof chunkDocument;
  /** Embedder remplaçable (tests sans réseau). */
  embed?: (texts: string[]) => Promise<number[][]>;
}

const MSG_MIGRATION =
  "Base incomplète : jouez les migrations 0003_ingestion_chunks.sql et 0004_embeddings_vector_storage.sql dans Supabase > SQL Editor > Run.";
const MSG_BUCKET =
  "Stockage non configuré : jouez la migration 0002_storage_resources.sql dans Supabase > SQL Editor > Run.";
const MSG_STORAGE =
  "Fichier introuvable dans le stockage : redéposez le document.";
const MSG_UNKNOWN =
  "Ingestion interrompue par une erreur technique : réessayez le dépôt.";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message ?? "");
  }
  return "";
}

/** Erreur de schéma ou de politique RLS : la migration 0003 n'est pas jouée. */
function looksLikeMissingMigration(message: string): boolean {
  return /(relation|column).*does not exist|schema cache|could not find the table|permission denied|row-level security/i.test(
    message,
  );
}


/**
 * Ingère un document déjà déposé : extraction, découpage et persistance
 * des morceaux. Ne lève jamais et marque la ressource en échec le cas échéant.
 */
export async function ingestResource({
  resourceId,
  deps,
}: {
  resourceId: string;
  deps: IngestDeps;
}): Promise<IngestResult> {
  const fail = async (reason: string): Promise<IngestResult> => {
    try {
      await deps.markFailed(reason);
    } catch {
      // La raison est tout de même renvoyée à l'admin.
    }
    return { ok: false, chunkCount: 0, message: reason };
  };

  let data: Uint8Array;
  try {
    data = await deps.readDocument();
  } catch (error) {
    const raw = errorMessage(error);
    if (/bucket/i.test(raw)) return fail(MSG_BUCKET);
    if (/not found|introuvable|404/i.test(raw)) return fail(MSG_STORAGE);
    return fail(looksLikeMissingMigration(raw) ? MSG_MIGRATION : MSG_UNKNOWN);
  }

  const extract = deps.extract ?? extractText;
  let extraction: ExtractionResult;
  try {
    extraction = await extract({ data, fileName: deps.fileName });
  } catch (error) {
    return fail(error instanceof ExtractionError ? error.message : MSG_UNKNOWN);
  }

  const chunk = deps.chunk ?? chunkDocument;
  const chunks = chunk({
    resourceId,
    title: deps.title,
    text: extraction.text,
  });
  if (chunks.length === 0) return fail(EXTRACTION_MESSAGES.empty);

  // Vectorisation des morceaux via Gemini (lib/ai/embeddings, Story 2.3)
  let embeddings: number[][];
  try {
    if (deps.embed) {
      embeddings = await deps.embed(chunks.map((c) => c.content));
    } else {
      embeddings = await generateEmbeddings({
        texts: chunks.map((c) => c.content),
      });
    }
  } catch (error) {
    if (error instanceof EmbeddingError) {
      return fail(error.message);
    }
    return fail(
      `Échec de vectorisation : ${errorMessage(error) || "Erreur de communication avec l'API IA."}`,
    );
  }

  const chunksWithEmbeddings: ChunkWithEmbedding[] = chunks.map((c, idx) => ({
    ...c,
    embedding: embeddings[idx],
  }));

  try {
    await deps.replaceChunks(chunksWithEmbeddings);
    if (deps.markReady) {
      await deps.markReady(chunks.length);
    } else if (deps.markChunked) {
      await deps.markChunked(chunks.length);
    }
  } catch (error) {
    const raw = errorMessage(error);
    return fail(looksLikeMissingMigration(raw) ? MSG_MIGRATION : MSG_UNKNOWN);
  }

  return {
    ok: true,
    chunkCount: chunks.length,
    message: `${chunks.length} morceau(x) indexé(s) et prêt(s).`,
  };
}

export interface SupabaseIngestionInput {
  supabase: SupabaseClient;
  resourceId: string;
  title: string;
  /** Chemin de l'objet dans le bucket (porte l'extension du fichier). */
  storagePath: string;
  bucket?: string;
  geminiApiKey?: string;
}

/** Dépendances réelles : Supabase Storage (lecture) + tables (écriture). */
export function supabaseIngestDeps({
  supabase,
  resourceId,
  title,
  storagePath,
  bucket = INGESTION_BUCKET,
  geminiApiKey,
}: SupabaseIngestionInput): IngestDeps {
  return {
    title,
    fileName: storagePath,
    readDocument: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(storagePath);
      if (error || !data) {
        throw new Error(
          error?.message ?? "Fichier introuvable dans le stockage.",
        );
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    replaceChunks: async (chunks) => {
      const { error: deleteError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("resource_id", resourceId);
      if (deleteError) throw new Error(deleteError.message);

      const rows = chunks.map((chunk) => ({
        resource_id: resourceId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding ?? null,
      }));
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(rows);
      if (insertError) throw new Error(insertError.message);
    },
    markReady: async (chunkCount) => {
      const { error } = await supabase
        .from("resources")
        .update({
          status: "Prête",
          chunk_count: chunkCount,
          error_message: null,
        })
        .eq("id", resourceId);
      if (error) throw new Error(error.message);
    },
    markChunked: async (chunkCount) => {
      const { error } = await supabase
        .from("resources")
        .update({
          status: "Prête",
          chunk_count: chunkCount,
          error_message: null,
        })
        .eq("id", resourceId);
      if (error) throw new Error(error.message);
    },
    markFailed: async (reason) => {
      const { error } = await supabase
        .from("resources")
        .update({ status: "Échec", error_message: reason, chunk_count: 0 })
        .eq("id", resourceId);
      if (error) throw new Error(error.message);
    },
    embed: async (texts: string[]) => {
      return generateEmbeddings({ texts, apiKey: geminiApiKey });
    },
  };
}
