/**
 * Helpers purs de l'interface de chat (story 4.3, FR-10/FR-11/FR-12).
 *
 * Module sans dependance (ni Next, ni React, ni Supabase) pour rester
 * testable sans reseau via `npm run test:chat-ui`.
 */
import type { ChatEvent } from "../ai/chat.ts";
import type { RagCitation } from "../ai/rag.ts";

export const CHAT_UI_MESSAGES = {
  assistantGreeting:
    "Posez votre question sur les documents internes de NexaWorks.",
  thinking: "L'assistant rédige une réponse...",
  unauthorized: "Votre session a expiré. Reconnectez-vous pour poser une question.",
  networkError:
    "La connexion a été interrompue. Votre saisie est conservée, réessayez.",
  tooLong: "Question trop longue : 2000 caractères maximum. Reformulez de façon plus courte.",
  send: "Envoyer la question",
  newChat: "Nouvelle discussion",
  sourceDrawerTitle: "Source citée",
  emptyInput: "Écrivez une question avant d'envoyer.",
} as const;

export interface TextSegment {
  text: string;
  /** Null = texte simple ; sinon index 0-based de la citation correspondante. */
  citationIndex: number | null;
}

/**
 * Decoupe un texte assistant en segments texte / puces `[n]`.
 * Une puce n'est creee que si 1 <= n <= citationCount (les marqueurs
 * hors bornes restent en texte : pas de puce fantome, pas de crash).
 */
export function segmentAssistantText(
  text: string,
  citationCount: number,
): TextSegment[] {
  const source = text ?? "";
  const segments: TextSegment[] = [];
  if (!source) return segments;
  const maxIndex = Math.max(0, Math.floor(citationCount));
  let cursor = 0;
  for (;;) {
    const start = source.indexOf("[", cursor);
    if (start < 0) break;
    const end = source.indexOf("]", start + 1);
    if (end < 0) break;
    const digits = source.slice(start + 1, end);
    if (!/^\d{1,2}$/.test(digits)) {
      // Pas un marqueur de citation : on avance d'un caractere (bracket literal).
      if (start > cursor) segments.push({ text: source.slice(cursor, start), citationIndex: null });
      segments.push({ text: "[", citationIndex: null });
      cursor = start + 1;
      continue;
    }
    const n = Number(digits);
    if (n < 1 || n > maxIndex) {
      if (start > cursor) segments.push({ text: source.slice(cursor, start), citationIndex: null });
      segments.push({ text: source.slice(start, end + 1), citationIndex: null });
      cursor = end + 1;
      continue;
    }
    if (start > cursor) segments.push({ text: source.slice(cursor, start), citationIndex: null });
    segments.push({ text: digits, citationIndex: n - 1 });
    cursor = end + 1;
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), citationIndex: null });
  }
  if (segments.length === 0) return [{ text: source, citationIndex: null }];
  return segments;
}

/** Etat client deduit du flux NDJSON de /api/chat. */
export interface ChatStreamState {
  meta: { abstained: boolean; citations: RagCitation[]; suggestions: RagCitation[] } | null;
  text: string;
  done: boolean;
  error: string;
}

export function initialChatStreamState(): ChatStreamState {
  return { meta: null, text: "", done: false, error: "" };
}

/**
 * Applique un evenement NDJSON a l'etat du flux (pur, testable).
 * Les evenements inconnus ou malformes sont ignores silencieusement.
 */
export function reduceChatEvents(
  state: ChatStreamState,
  event: ChatEvent | { type?: unknown },
): ChatStreamState {
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    return state;
  }
  switch (event.type) {
    case "meta": {
      const meta = event as Extract<ChatEvent, { type: "meta" }>;
      return {
        ...state,
        meta: {
          abstained: Boolean(meta.abstained),
          citations: Array.isArray(meta.citations) ? meta.citations : [],
          suggestions: Array.isArray(meta.suggestions) ? meta.suggestions : [],
        },
      };
    }
    case "text": {
      const text = event as Extract<ChatEvent, { type: "text" }>;
      if (typeof text.text !== "string" || !text.text) return state;
      return { ...state, text: state.text + text.text };
    }
    case "done":
      return { ...state, done: true };
    case "error": {
      const err = event as Extract<ChatEvent, { type: "error" }>;
      return {
        ...state,
        done: true,
        error:
          typeof err.message === "string" && err.message
            ? err.message
            : CHAT_UI_MESSAGES.networkError,
      };
    }
    default:
      return state;
  }
}

/** Arias-label des puces (EXPERIENCE §4 : « Source 1 : Titre »). */
export function citationAriaLabel(index: number, citation?: RagCitation): string {
  const number = index + 1;
  const title = citation?.title?.trim();
  return title ? `Source ${number} : ${title}` : `Source ${number}`;
}

/** Bulle d'abstention : bordure ambre + pistes presentees comme telles. */
export function suggestionLeads(meta: ChatStreamState["meta"]): RagCitation[] {
  if (!meta || !meta.abstained) return [];
  return meta.suggestions.filter((s) => s.asLead);
}
