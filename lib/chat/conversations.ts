/**
 * Helpers purs de persistance des conversations (story 4.4, FR-13).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:conversation`.
 */
import { clampHistory, type ChatTurn, type ChatMeta, type RagCitation } from "../ai/rag.ts";
import type { ChatStreamState } from "./ui.ts";

export const CONVERSATION_MESSAGES = {
  notOwner: "Cette conversation ne vous appartient pas ou n'existe plus.",
  defaultTitle: "Nouvelle conversation",
  loadFailure:
    "Impossible de charger cette conversation. Retournez à l'assistant.",
} as const;

export const MAX_TITLE_LENGTH = 60;

/**
 * Titre automatique derive de la premiere question (FR-13) :
 * tronque a MAX_TITLE_LENGTH en fin de mot, jamais vide.
 */
export function deriveConversationTitle(question: string): string {
  const source = (question ?? "").replace(/\s+/g, " ").trim();
  if (!source) return CONVERSATION_MESSAGES.defaultTitle;
  if (source.length <= MAX_TITLE_LENGTH) return source;
  const cut = source.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > MAX_TITLE_LENGTH * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

/** Ligne `messages` (conversation_id, role, content, meta) depuis la DB. */
export interface MessageRow {
  id: string;
  role: string;
  content: string;
  meta?: unknown;
  created_at?: string;
}

/** Valide et borne le meta stocke (ancien message sans meta -> {}). */
export function parseStoredMeta(raw: unknown): ChatMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<ChatMeta>;
  const citations = Array.isArray(obj.citations)
    ? (obj.citations.filter(isCitation) as RagCitation[])
    : [];
  const suggestions = Array.isArray(obj.suggestions)
    ? (obj.suggestions.filter(isCitation) as RagCitation[])
    : [];
  if (citations.length === 0 && suggestions.length === 0 && !obj.abstained) {
    return null;
  }
  return { abstained: Boolean(obj.abstained), citations, suggestions };
}

function isCitation(value: unknown): value is RagCitation {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<RagCitation>;
  return typeof c.sourceId === "string" && typeof c.title === "string";
}

/**
 * Lignes DB -> historique pour la generation (8 derniers tours valides).
 * Les meta/roles invalides sont ignores, l'ordre chronologique preserve.
 */
export function rowsToHistory(rows: unknown): ChatTurn[] {
  if (!Array.isArray(rows)) return [];
  const turns = rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Partial<MessageRow>;
      if (r.role !== "user" && r.role !== "assistant") return null;
      if (typeof r.content !== "string" || !r.content.trim()) return null;
      return { role: r.role, content: r.content } as ChatTurn;
    })
    .filter((t): t is ChatTurn => t !== null);
  return clampHistory(turns);
}

/** Message initial de l'UI reconstitue depuis une ligne DB. */
export interface InitialChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  stream: ChatStreamState | null;
}

/**
 * Lignes DB -> messages initiaux de l'ecran /chat/[id].
 * L'assistant reprend son meta (puces + abstention) pour relecture fidele.
 */
export function rowsToInitialMessages(rows: unknown): InitialChatMessage[] {
  if (!Array.isArray(rows)) return [];
  const out: InitialChatMessage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<MessageRow>;
    if (r.role !== "user" && r.role !== "assistant") continue;
    if (typeof r.content !== "string" || !r.content.trim()) continue;
    const id = typeof r.id === "string" && r.id ? r.id : `row-${out.length}`;
    if (r.role === "assistant") {
      out.push({
        id,
        role: "assistant",
        text: r.content,
        stream: {
          meta: parseStoredMeta(r.meta),
          text: r.content,
          done: true,
          error: "",
        },
      });
    } else {
      out.push({ id, role: "user", text: r.content, stream: null });
    }
  }
  return out;
}

/** Nombre maximum de conversations listees sur /history (story 5.2, FR-15). */

/** Nombre maximum de conversations listees sur /history (story 5.2, FR-15). */
export const HISTORY_LIMIT = 50;

/** Ligne d'historique : une conversation et son nombre d'echanges. */
export interface HistoryItem {
  id: string;
  title: string;
  /** ISO 8601 : formate ensuite par `formatRelativeDate`. */
  createdAt: string;
  /** Nombre de questions de l'utilisateur (1 question = 1 echange). */
  exchangeCount: number;
}

/** Ligne `messages` minimale pour le comptage des echanges. */
export interface HistoryMessageRef {
  conversation_id: string;
  role: string;
}

/** Un echange = une question utilisateur, reponse ou pas. */
function countExchanges(
  messageRows: unknown,
  conversationIds: Set<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!Array.isArray(messageRows)) return counts;
  for (const row of messageRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<HistoryMessageRef>;
    if (typeof r.conversation_id !== "string") continue;
    if (!conversationIds.has(r.conversation_id)) continue;
    // Seule la question ouvre un echange : une reponse manquante ne le fait
    // pas disparaitre, une reponse orpheline ne cree pas d'echange fantome.
    if (r.role !== "user") continue;
    counts.set(r.conversation_id, (counts.get(r.conversation_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Lignes DB -> elements d'historique (story 5.2, FR-15).
 *
 * Tri par `created_at` decroissant, plafond `HISTORY_LIMIT`, titre et date
 * normalises. Pur : aucun acces reseau, testable via `npm run test:history`.
 */
export function buildHistoryItems(
  conversationRows: unknown,
  messageRows: unknown,
): HistoryItem[] {
  if (!Array.isArray(conversationRows)) return [];

  const valid: Array<{
    id: string;
    title: string;
    createdAt: string;
    timestamp: number;
  }> = [];
  for (const row of conversationRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as { id?: unknown; title?: unknown; created_at?: unknown };
    if (typeof r.id !== "string" || !r.id) continue;
    const title =
      typeof r.title === "string" && r.title.trim()
        ? r.title.trim()
        : CONVERSATION_MESSAGES.defaultTitle;
    const createdAt = typeof r.created_at === "string" ? r.created_at : "";
    const parsed = Date.parse(createdAt);
    valid.push({
      id: r.id,
      title,
      createdAt,
      // Une date invalide passe en fin de liste plutot que de casser le tri.
      timestamp: Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed,
    });
  }

  valid.sort((a, b) => b.timestamp - a.timestamp);
  const limited = valid.slice(0, HISTORY_LIMIT);
  const ids = new Set(limited.map((c) => c.id));
  const counts = countExchanges(messageRows, ids);

  return limited.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    exchangeCount: counts.get(c.id) ?? 0,
  }));
}

/** Libelle FR du compteur d'echanges (singulier inclus). */
export function formatExchangeLabel(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return n === 1 ? "1 échange" : `${n} échanges`;
}
