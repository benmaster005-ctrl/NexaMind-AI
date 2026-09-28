/**
 * Service RAG (story 4.1, FR-10/FR-12, AD-1).
 * Injection des chunks grounds dans le prompt systeme + regle d'abstention.
 * Testable sans reseau : acces externes injectes via `RagDeps`.
 */
import type { SearchResult } from "./search.ts";
import { truncateExcerpt } from "../search/ui.ts";

/** Seuil de grounding re-verifie cote service (AD-1). */
export const RAG_THRESHOLD = 0.65;
/** Plafond de ressources citees par reponse (FR-11). */
export const MAX_CITATIONS = 5;
/** Pistes proposees en cas d'abstention (FR-12 : 2-3 documents). */
export const MAX_SUGGESTIONS = 3;
export const MAX_QUESTION_LENGTH = 2000;
export const MAX_CONTEXT_CHARS = 8000;
export const MAX_HISTORY_TURNS = 8;
export const MAX_HISTORY_TURN_CHARS = 2000;
export const MIN_CONTEXT_CHARS_PER_SOURCE = 400;
export const MAX_EXCERPT_CHARS = 600;

export const RAG_MESSAGES = {
  emptyQuestion: "Posez une question pour interroger l'assistant.",
  questionTooLong:
    "Question trop longue : 2000 caractères maximum. Reformulez de façon plus courte.",
  retrievalFailure:
    "L'assistant est temporairement indisponible. Vérifiez votre connexion et réessayez.",
  generationFailure:
    "La génération de la réponse a échoué. Réessayez dans un instant.",
  /** Flux termine sans aucun texte : message neutre (zero-hallucination). */
  generationEmpty:
    "Aucune réponse n'a pu être produite à partir des documents. Reformulez votre question ou réessayez dans un instant.",
  unauthorized: "Connectez-vous pour poser une question à l'assistant.",
} as const;

/** Formule standard d'abstention (EXPERIENCE.md etat Abstention, AD-1). */
export const ABSTENTION_MESSAGE =
  "Cette information n'a pas été trouvée dans les documents internes de NexaWorks.";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface RagCitation {
  sourceId: string;
  title: string;
  category: string;
  chunkId: string | null;
  excerpt: string;
  /** true = document proche presente comme piste, jamais comme reponse (FR-12). */
  asLead: boolean;
}

export interface RagDeps {
  /** Retrieval hybride : wrapper de searchDocuments (deps recherche injectees). */
  retrieve: (query: string) => Promise<SearchResult[]>;
  /** Generation LLM : `generateText` cote route, factice en test. */
  generate: (input: { system: string; messages: ChatTurn[] }) => Promise<string>;
}

export interface RagOptions {
  question: string;
  history?: ChatTurn[];
  deps: RagDeps;
}

export interface RagOutcome {
  ok: boolean;
  answer: string;
  citations: RagCitation[];
  suggestions: RagCitation[];
  abstained: boolean;
  message: string;
}

function truncate(text: string, max: number): string {
  const source = (text ?? "").trim();
  if (source.length <= max) return source;
  return `${source.slice(0, max)}…`;
}

/** borne l'historique : derniers tours, contenu tronque (FR-13). */
export function clampHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  const turns: ChatTurn[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const role = (item as ChatTurn).role;
    const content = (item as ChatTurn).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    turns.push({ role, content: truncate(content, MAX_HISTORY_TURN_CHARS) });
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

function toCitation(result: SearchResult, asLead: boolean): RagCitation {
  return {
    sourceId: result.resourceId,
    title: result.title,
    category: result.category,
    chunkId: result.chunkId,
    excerpt: truncateExcerpt(result.excerpt, MAX_EXCERPT_CHARS),
    asLead,
  };
}

/**
 * Selectionne les chunks grounds (semantique + similarite >= 0.65) distincts
 * par ressource, plafonne a MAX_CITATIONS. Les autres resultats deviennent
 * des pistes candidates (jamais presentes comme reponse).
 */
export function selectGrounded(results: SearchResult[]): {
  grounded: SearchResult[];
  leads: SearchResult[];
} {
  const grounded: SearchResult[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.matchKind !== "semantic") continue;
    if (r.similarity === null || r.similarity < RAG_THRESHOLD) continue;
    if (seen.has(r.resourceId)) continue;
    seen.add(r.resourceId);
    grounded.push(r);
    if (grounded.length >= MAX_CITATIONS) break;
  }
  const leads: SearchResult[] = [];
  for (const r of results) {
    if (leads.length >= MAX_SUGGESTIONS) break;
    if (seen.has(r.resourceId)) continue;
    seen.add(r.resourceId);
    leads.push(r);
  }
  return { grounded, leads };
}

/** Metadonnees de reponse envoyees en tete de flux (FR-11). */
export interface ChatMeta {
  abstained: boolean;
  citations: RagCitation[];
  suggestions: RagCitation[];
}

/** Contexte prepare : grounde (reponse) ou abstention (pistes). */
export interface RagContext {
  ok: boolean;
  abstained: boolean;
  grounded: SearchResult[];
  leads: SearchResult[];
  message: string;
}

/**
 * Prepare le contexte RAG a partir des resultats de retrieval.
 * Ne leve jamais : { ok, abstained, grounded, leads, message }.
 */
export function prepareRagContext(results: SearchResult[]): RagContext {
  const { grounded, leads } = selectGrounded(results);
  if (grounded.length === 0) {
    return {
      ok: true,
      abstained: true,
      grounded: [],
      leads: leads.slice(0, MAX_SUGGESTIONS),
      message: "",
    };
  }
  return { ok: true, abstained: false, grounded, leads: [], message: "" };
}

/** Decision de tour de conversation pour la route streamante (story 4.2). */
export type ChatTurnPlan =
  | { kind: "error"; message: string }
  | { kind: "abstained"; meta: ChatMeta; answer: string }
  | { kind: "grounded"; meta: ChatMeta; system: string; messages: ChatTurn[] };

/**
 * Valide la question, execute le retrieval et decide abstention ou
 * generation. Partage par la route /api/chat (stream) et answerQuestion.
 */
export async function prepareChatTurn(options: {
  question: string;
  history?: unknown;
  retrieve: (query: string) => Promise<SearchResult[]>;
}): Promise<ChatTurnPlan> {
  const question = (options.question ?? "").trim();
  if (!question) return { kind: "error", message: RAG_MESSAGES.emptyQuestion };
  if (question.length > MAX_QUESTION_LENGTH) {
    return { kind: "error", message: RAG_MESSAGES.questionTooLong };
  }

  let results: SearchResult[];
  try {
    results = await options.retrieve(question);
  } catch {
    return { kind: "error", message: RAG_MESSAGES.retrievalFailure };
  }

  const context = prepareRagContext(Array.isArray(results) ? results : []);
  const meta: ChatMeta = {
    abstained: context.abstained,
    citations: context.grounded.map((r) => toCitation(r, false)),
    suggestions: context.leads.map((r) => toCitation(r, true)),
  };

  if (context.abstained) {
    return { kind: "abstained", meta, answer: ABSTENTION_MESSAGE };
  }
  return {
    kind: "grounded",
    meta,
    system: buildSystemPrompt(context.grounded),
    messages: [
      ...clampHistory(options.history),
      { role: "user", content: question },
    ],
  };
}

/**
 * Pipeline complet : validation -> retrieval -> grounding/abstention ->
 * generation. En cas d'abstention, aucune generation n'est appelée et la
 * formule standard est renvoyee directement (zéro-hallucination).
 */
export async function answerQuestion(
  options: RagOptions,
): Promise<RagOutcome> {
  const failure = (message: string): RagOutcome => ({
    ok: false,
    answer: "",
    citations: [],
    suggestions: [],
    abstained: false,
    message,
  });

  const plan = await prepareChatTurn({
    question: options.question,
    history: options.history,
    retrieve: options.deps.retrieve,
  });

  if (plan.kind === "error") return failure(plan.message);
  if (plan.kind === "abstained") {
    return {
      ok: true,
      answer: plan.answer,
      citations: [],
      suggestions: plan.meta.suggestions,
      abstained: true,
      message: "",
    };
  }

  let answer: string;
  try {
    answer = await options.deps.generate({
      system: plan.system,
      messages: plan.messages,
    });
  } catch {
    return failure(RAG_MESSAGES.generationFailure);
  }

  const trimmedAnswer = (answer ?? "").trim();
  if (!trimmedAnswer) return failure(RAG_MESSAGES.generationFailure);

  return {
    ok: true,
    answer: trimmedAnswer,
    citations: plan.meta.citations,
    suggestions: [],
    abstained: false,
    message: "",
  };
}

/** Prompt systeme AD-1 : reponse unique issue des sources + citation [n]. */
export function buildSystemPrompt(grounded: SearchResult[]): string {
  const sections = grounded.map(
    (r, i) =>
      `[${i + 1}] ${r.title} — ${r.category}\n` +
      truncate(r.excerpt, MIN_CONTEXT_CHARS_PER_SOURCE * 3),
  );
  const sources = sections.join("\n\n");
  return [
    "Tu es l'assistant interne de NexaWorks. Tu réponds en français, à partir EXCLUSIVEMENT des sources numérotées ci-dessous.",
    "Règles strictes :",
    "- N'invente aucun chiffre, date, nom ou fait absent des sources.",
    "- Chaque affirmation appuyée sur une source cite la référence [n] en fin de phrase.",
    "- Si les sources ne contiennent pas l'information, réponds exactement :",
    `  « ${ABSTENTION_MESSAGE} »`,
    "- Structure ta réponse en étapes numérotées ou puces si elle dépasse trois phrases.",
    "- N'évoque jamais l'existence de documents hors de la liste.",
    "",
    "Sources :",
    sources,
  ].join("\n");
}
