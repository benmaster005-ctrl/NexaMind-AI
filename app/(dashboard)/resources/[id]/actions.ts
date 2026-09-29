"use server";

/**
 * Action serveur « Résumer » (story 5.1, FR-14).
 *
 * Accessible a tout utilisateur authentifie. Lecture via RLS
 * (`authenticated_read_resources` / `authenticated_read_chunks`),
 * generation Gemini cote serveur uniquement
 * (AD-4 : la cle ne sort jamais du serveur).
 *
 * Aucune ecriture : le resume n'est ni stocke ni indexe.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

import { createClient } from "@/lib/supabase/server";
import { getGeminiApiKey } from "@/lib/ai/embeddings";
import {
  SUMMARY_MESSAGES,
  SUMMARY_MODEL,
  summarizeResource,
} from "@/lib/ai/summary";

/**
 * Duree de validite du lien vers le document complet.
 * 15 minutes : le lien doit rester valable le temps que l'utilisateur lit
 * la synthese avant de l'ouvrir.
 */
const SIGNED_URL_TTL_SECONDS = 900;

/** Bornes de sortie : 8 puces courtes (garde-fou sur le temps de generation). */
const MAX_OUTPUT_TOKENS = 600;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SummarizeActionResult {
  success: boolean;
  /** 5 a 8 puces, vide en cas d'echec. */
  bullets: string[];
  /** true si la source a depasse le plafond de contexte. */
  partial: boolean;
  /** Lien signe vers le fichier, null si indisponible ou si echec. */
  documentUrl: string | null;
  /** Message FR : erreur, ou avertissement « resume partiel ». */
  message: string;
}

function failure(message: string): SummarizeActionResult {
  return { success: false, bullets: [], partial: false, documentUrl: null, message };
}

/**
 * Genere la synthese d'une ressource au statut Pret.
 * Ne leve jamais : toute erreur devient un message FR.
 */
export async function summarizeResourceAction(
  resourceId: string,
): Promise<SummarizeActionResult> {
  const id = String(resourceId ?? "").trim();
  if (!UUID_RE.test(id)) return failure(SUMMARY_MESSAGES.notFound);

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return failure(SUMMARY_MESSAGES.generationFailure);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure(SUMMARY_MESSAGES.unauthorized);

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("id, title, category, status, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (resourceError || !resource) return failure(SUMMARY_MESSAGES.notFound);

  // Les morceaux sont lus dans l'ordre : le resume suit la lecture du document.
  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("content")
    .eq("resource_id", id)
    .order("chunk_index", { ascending: true });
  if (chunksError) return failure(SUMMARY_MESSAGES.generationFailure);

  let outcome;
  try {
    outcome = await summarizeResource({
      source: {
        title: resource.title ?? "",
        category: resource.category ?? "",
        status: resource.status ?? "",
        chunks: (chunks ?? []).map((c) => String(c.content ?? "")),
      },
      deps: {
        generate: async ({ system, prompt }) => {
          const google = createGoogleGenerativeAI({ apiKey: getGeminiApiKey() });
          const { text } = await generateText({
            model: google.languageModel(SUMMARY_MODEL),
            system,
            prompt,
            maxTokens: MAX_OUTPUT_TOKENS,
          });
          return text ?? "";
        },
      },
    });
  } catch {
    return failure(SUMMARY_MESSAGES.generationFailure);
  }

  if (!outcome.ok) return failure(outcome.message);

  // Renvoi vers le document complet (AC) : URL signee, jamais de lecture
  // directe du fichier par le navigateur. Un lien indisponible n'annule pas
  // la synthese affichee.
  let documentUrl: string | null = null;
  if (resource.storage_path) {
    try {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(resource.storage_path, SIGNED_URL_TTL_SECONDS);
      documentUrl = signed?.signedUrl ?? null;
    } catch {
      documentUrl = null;
    }
  }

  return {
    success: true,
    bullets: outcome.bullets,
    partial: outcome.partial,
    documentUrl,
    message: outcome.message,
  };
}
