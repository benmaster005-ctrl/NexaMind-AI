/**
 * Helpers purs de la route de streaming /api/chat (story 4.2, FR-10/FR-11).
 *
 * Protocole NDJSON : une ligne JSON par evenement.
 *   1. {"type":"meta","abstained":...,"citations":[...],"suggestions":[...]}
 *   2. N x {"type":"text","text":"..."}   (reponse en flux)
 *   3. {"type":"done"}
 *   ou {"type":"error","message":"..."} en cas d'erreur en cours de flux.
 *
 * Module sans dependance IA/Reseau : testable via `npm run test:chat`.
 */
import {
  MAX_QUESTION_LENGTH,
  RAG_MESSAGES,
  clampHistory,
  type ChatMeta,
  type ChatTurn,
  type RagCitation,
} from "./rag.ts";

export type ChatEvent =
  | {
      type: "meta";
      abstained: boolean;
      citations: RagCitation[];
      suggestions: RagCitation[];
      /** Conversation persistee (story 4.4) : absente si persistance KO. */
      conversationId?: string;
    }
  | { type: "text"; text: string }
  | {
      type: "done";
      /** Raison de fin Gemini (diagnostic : "stop", "length", "content-filter"…). */
      finishReason?: string;
    }
  | { type: "error"; message: string };

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
  conversationId: string | null;
}

export interface ParsedChatRequest {
  ok: boolean;
  question: string;
  history: ChatTurn[];
  /** uuid stringifie valide, sinon null (nouvelle conversation 4.4). */
  conversationId: string | null;
  message: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalise conversationId : uuid valide ou null (jamais de string libre). */
export function normalizeConversationId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Parse et valide le corps JSON { question, history?, conversationId? }. */
export function parseChatRequest(raw: unknown): ParsedChatRequest {
  const invalid = (message: string): ParsedChatRequest => ({
    ok: false,
    question: "",
    history: [],
    conversationId: null,
    message,
  });
  if (!raw || typeof raw !== "object") {
    return invalid(RAG_MESSAGES.emptyQuestion);
  }
  const body = raw as {
    question?: unknown;
    history?: unknown;
    conversationId?: unknown;
  };
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return invalid(RAG_MESSAGES.emptyQuestion);
  if (question.length > MAX_QUESTION_LENGTH) {
    return invalid(RAG_MESSAGES.questionTooLong);
  }
  return {
    ok: true,
    question,
    history: clampHistory(body.history),
    conversationId: normalizeConversationId(body.conversationId),
    message: "",
  };
}

/** Encode un evenement en une ligne NDJSON (sans saut de ligne interne). */
export function encodeChatEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Construit l'evenement meta de tete de flux a partir du meta RAG. */
export function metaEvent(meta: ChatMeta, conversationId?: string): ChatEvent {
  return {
    type: "meta",
    abstained: meta.abstained,
    citations: meta.citations,
    suggestions: meta.suggestions,
    ...(conversationId ? { conversationId } : {}),
  };
}

export interface ChatStreamOptions {
  meta: ChatMeta;
  /** Conversation persistee (4.4) : relayee dans l'evenement meta. */
  conversationId?: string;
  /** Source du texte : generateur asynchrone (textStream du AI SDK) ou fixe. */
  textSource: AsyncIterable<string> | Iterable<string>;
  /** Si true, n'attend pas de source (abstention : texte fourni directement). */
  staticText?: string;
  /** Encodeur (injectable pour les tests). */
  encode?: (event: ChatEvent) => string;
  /** Appelle apres chaque chunk de texte (persistance 4.4, best effort). */
  onText?: (fullText: string) => void;
  /** Appelle une fois la source epuisee, avant close (persistance 4.4). */
  onFinish?: (fullText: string) => void | Promise<void>;
  /**
   * Texte de secours emis si la source n'a produit AUCUN caractere
   * (Gemini peut repondre vide : finishReason "length" sur modele pensant).
   * Zero-hallucination : message neutre, jamais une reponse inventee.
   */
  emptyFallback?: string;
  /** Champs additionnels fusionnes dans l'evenement `done` (finishReason). */
  beforeDone?: () => { finishReason?: string } | undefined;
}

/**
 * Fabrique le ReadableStream NDJSON envoye au client :
 * meta d'abord (citations connues avant generation), puis le texte filant,
 * puis done. Un `error` est emis si la source lève en cours de route.
 */
export function createChatEventStream(
  options: ChatStreamOptions,
): ReadableStream<Uint8Array> {
  const encode = options.encode ?? encodeChatEvent;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(encode(metaEvent(options.meta, options.conversationId))),
      );
      let fullText = "";
      try {
        if (options.staticText !== undefined) {
          fullText = options.staticText;
          controller.enqueue(
            encoder.encode(encode({ type: "text", text: options.staticText })),
          );
        } else {
          for await (const chunk of options.textSource as AsyncIterable<string>) {
            if (typeof chunk === "string" && chunk) {
              fullText += chunk;
              controller.enqueue(
                encoder.encode(encode({ type: "text", text: chunk })),
              );
              try {
                options.onText?.(fullText);
              } catch {
                // Persistance best effort : ne jamais interrompre le flux.
              }
            }
          }
        }
        // Reponse vide cote modele : on n'affiche jamais une bulle blanche.
        if (!fullText.trim() && options.emptyFallback) {
          fullText = options.emptyFallback;
          controller.enqueue(
            encoder.encode(encode({ type: "text", text: fullText })),
          );
        }
        const doneExtra = options.beforeDone?.();
        controller.enqueue(
          encoder.encode(encode({ type: "done", ...(doneExtra ?? {}) })),
        );
        try {
          // Attendu avant close() : garantit que la persistance survit a la
          // fin du flux cote serverless (best effort sinon).
          await options.onFinish?.(fullText);
        } catch {
          // Persistance best effort : le texte est deja emis, pas de crash.
        }
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            encode({
              type: "error",
              message:
                err instanceof Error && err.message
                  ? err.message
                  : RAG_MESSAGES.generationFailure,
            }),
          ),
        );
        controller.enqueue(encoder.encode(encode({ type: "done" })));
        controller.close();
      }
    },
    cancel() {
      // Interruption client : fermeture propre, aucune exception (ticket 4.2).
    },
  });
}

/** Headers de la reponse streamante NDJSON. */
export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
} as const;
