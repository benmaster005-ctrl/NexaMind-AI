/**
 * Helpers purs de l'interface de chat (story 4.3, FR-10/FR-11/FR-12).
 *
 * Module sans dependance (ni Next, ni React, ni Supabase) pour rester
 * testable sans reseau via `npm run test:chat-ui`. Le rendu markdown-lite des
 * reponses vient de `lib/text/markdown.ts` (voir egalement
 * `npm run test:markdown`).
 */
import type { ChatEvent } from "../ai/chat.ts";
import type { RagCitation } from "../ai/rag.ts";
import { tokenizeInline } from "../text/markdown.ts";

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
  /** Bloc de sources (FR-11) : la reference reste accessible meme sans [n] dans le texte. */
  sourcesTitle: "Sources",
  sourcesWithoutMarker:
    "La réponse ne renvoie pas à ses références dans le texte : les documents utilisés sont listés ici.",
  drawerOpenPassage: "Ouvrir dans le document",
  drawerOpenDocument: "Ouvrir le document",
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
 *
 * Le decoupage inline est celui du rendu markdown-lite : les marqueurs
 * d'emphase (`**gras**`, `` `code` ``) sont retires au passage, jamais
 * affiches.
 */
export function segmentAssistantText(
  text: string,
  citationCount: number,
): TextSegment[] {
  const source = text ?? "";
  if (!source) return [];
  const segments: TextSegment[] = [];
  for (const token of tokenizeInline(source, citationCount)) {
    const last = segments[segments.length - 1];
    if (token.citationIndex === null && last && last.citationIndex === null) {
      last.text += token.text;
      continue;
    }
    segments.push({ text: token.text, citationIndex: token.citationIndex });
  }
  if (segments.length === 0) return [{ text: source, citationIndex: null }];
  return segments;
}

/**
 * La reponse porte-t-elle au moins une puce `[n]` cliquable ? Le modele peut
 * produire une reponse fondee sans marqueur : le bloc de sources prend le
 * relais, mais le libelle change pour rester honnete (FR-11).
 */
export function answerHasInlineCitations(text: string, citationCount: number): boolean {
  return segmentAssistantText(text, citationCount).some((s) => s.citationIndex !== null);
}

/**
 * Sources a afficher sous la reponse, dans l'ordre de numerotation du prompt
 * (les puces `[n]` du texte designent ces memes indices). En abstention, le
 * bloc est vide : ce sont les « pistes » qui prennent le relais.
 */
export function answerSources(
  meta: ChatStreamState["meta"],
): Array<{ index: number; citation: RagCitation }> {
  if (!meta || meta.abstained) return [];
  return meta.citations.map((citation, index) => ({ index, citation }));
}

/**
 * Lien d'une citation vers la fiche du document (story 6.1). L'ancre
 * `?chunk=` n'est ajoutee que si le morceau est connu : un resultat purement
 * textuel (titre/categories) n'a pas de chunk, mais doit quand meme mener au
 * document — sinon la reference ne serait pas cliquable.
 */
export function citationHref(citation: RagCitation): string {
  const base = `/resources/${citation.sourceId}`;
  return citation.chunkId ? `${base}?chunk=${citation.chunkId}` : base;
}

/** Libelle du lien de tiroir : ancre vers le passage, ou document entier. */
export function citationLinkLabel(citation: RagCitation): string {
  return citation.chunkId
    ? CHAT_UI_MESSAGES.drawerOpenPassage
    : CHAT_UI_MESSAGES.drawerOpenDocument;
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
