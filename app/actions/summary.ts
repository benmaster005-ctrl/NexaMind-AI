"use server";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

import { createClient } from "@/lib/supabase/server";
import { getGeminiApiKey } from "@/lib/ai/embeddings";
import {
  SUMMARY_MESSAGES,
  SUMMARY_MODEL,
  summarizeResource,
} from "@/lib/ai/summary";

const SIGNED_URL_TTL_SECONDS = 900;
const MAX_OUTPUT_TOKENS = 600;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SummarizeActionResult {
  success: boolean;
  bullets: string[];
  partial: boolean;
  documentUrl: string | null;
  message: string;
}

function failure(message: string): SummarizeActionResult {
  return { success: false, bullets: [], partial: false, documentUrl: null, message };
}

/**
 * Génère la synthèse d'une ressource au statut Prêt.
 * Utilisable directement dans le workspace ou les fiches documentaires.
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
