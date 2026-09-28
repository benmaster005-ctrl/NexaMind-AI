/**
 * Service d'embeddings vectoriels via Google Gemini (AD-3, AD-4, FR-6).
 * Modèle principal : `gemini-embedding-001` (dimensionnalité fixe de 768) —
 * c'est le modèle ayant produit les vecteurs stockés en base ; `text-embedding-004`
 * a été retiré de l'API Gemini (404 NOT_FOUND) et reste en dernier recours.
 * Clé : lue côté serveur via GEMINI_API_KEY ou GOOGLE_GENERATIVE_AI_API_KEY.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";

export const EMBEDDING_MODELS = [
  "gemini-embedding-001",
  "gemini-embedding-2",
  "text-embedding-004",
] as const;
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSION = 768;
export const MAX_BATCH_SIZE = 100;
export const MAX_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 300;

export class EmbeddingError extends Error {
  readonly code: "MISSING_KEY" | "RATE_LIMIT" | "INVALID_DIMENSION" | "API_ERROR";

  constructor(
    code: "MISSING_KEY" | "RATE_LIMIT" | "INVALID_DIMENSION" | "API_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "EmbeddingError";
    this.code = code;
  }
}

export interface EmbedChunksOptions {
  texts: string[];
  apiKey?: string;
  modelName?: string;
  batchSize?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  customEmbedMany?: (options: {
    values: string[];
    apiKey: string;
  }) => Promise<{ embeddings: number[][] }>;
}

export function getGeminiApiKey(explicitKey?: string): string {
  const key =
    explicitKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new EmbeddingError(
      "MISSING_KEY",
      "Clé API Gemini manquante. Veuillez renseigner GEMINI_API_KEY dans votre fichier .env.local côté serveur.",
    );
  }
  return key;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : undefined;

  return (
    status === 429 ||
    /429|resource_exhausted|rate limit|quota exceeded|too many requests/i.test(
      msg,
    )
  );
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calcule les embeddings d'une liste de textes via Gemini (modèle principal
 * `gemini-embedding-001`, 768 dimensions, avec chaîne de repli).
 * Gère le batching (max 100) et le retry avec backoff exponentiel.
 */
export async function generateEmbeddings(
  options: EmbedChunksOptions,
): Promise<number[][]> {
  const { texts } = options;
  if (!texts || texts.length === 0) {
    return [];
  }

  const apiKey = getGeminiApiKey(options.apiKey);
  const batchSize = Math.min(options.batchSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const initialBackoffMs = options.initialBackoffMs ?? INITIAL_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;

  const batches = chunkArray(texts, batchSize);
  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    let attempts = 0;
    let batchSuccess = false;

    while (attempts <= maxRetries && !batchSuccess) {
      try {
        let embeddings: number[][];

        if (options.customEmbedMany) {
          const res = await options.customEmbedMany({ values: batch, apiKey });
          embeddings = res.embeddings;
        } else {
          const googleClient = createGoogleGenerativeAI({ apiKey });
          const candidateModels = options.modelName
            ? [options.modelName]
            : [...EMBEDDING_MODELS];

          let lastError: unknown = null;
          let generated: { embeddings: number[][] } | null = null;

          for (const modelCandidate of candidateModels) {
            try {
              const model = googleClient.textEmbeddingModel(modelCandidate, {
                outputDimensionality: EMBEDDING_DIMENSION,
              });
              generated = await embedMany({
                model,
                values: batch,
              });
              if (generated) break;
            } catch (err) {
              lastError = err;
              const msg = err instanceof Error ? err.message : String(err);
              // Si le modèle n'est pas supporté ou introuvable, essayer le modèle candidat suivant
              if (/not found|not supported/i.test(msg)) {
                continue;
              }
              // Si c'est un problème d'API/quota/réseau, le propager au mécanisme de retry
              throw err;
            }
          }

          if (!generated) {
            throw lastError ?? new Error("Impossible de trouver un modèle d'embedding Gemini compatible.");
          }
          embeddings = generated.embeddings;
        }

        if (embeddings.length !== batch.length) {
          throw new EmbeddingError(
            "API_ERROR",
            `Incohérence du nombre d'embeddings reçus : ${embeddings.length} reçus pour ${batch.length} demandés.`,
          );
        }

        for (const emb of embeddings) {
          if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIMENSION) {
            throw new EmbeddingError(
              "INVALID_DIMENSION",
              `Dimension d'embedding invalide : ${emb?.length ?? 0} au lieu de ${EMBEDDING_DIMENSION}.`,
            );
          }
        }

        allEmbeddings.push(...embeddings);
        batchSuccess = true;
      } catch (err) {
        if (
          err instanceof EmbeddingError &&
          (err.code === "INVALID_DIMENSION" || err.code === "MISSING_KEY")
        ) {
          throw err;
        }

        const isRateLimit = isRateLimitError(err);
        attempts += 1;

        if (attempts <= maxRetries) {
          const backoff =
            initialBackoffMs * Math.pow(2, attempts - 1) +
            Math.floor(Math.random() * 50);
          await sleep(backoff);
        } else {
          if (isRateLimit) {
            throw new EmbeddingError(
              "RATE_LIMIT",
              "Quota ou limite de débit dépassée sur l'API Gemini après plusieurs tentatives.",
            );
          }
          const rawMsg = err instanceof Error ? err.message : String(err);
          throw new EmbeddingError(
            "API_ERROR",
            `Échec de la génération vectorielle Gemini : ${rawMsg}`,
          );
        }
      }
    }
  }

  return allEmbeddings;
}

