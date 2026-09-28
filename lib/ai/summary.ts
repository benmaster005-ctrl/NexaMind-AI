/**
 * Synthèse automatique d'une ressource (Epic 5, story 5.1, FR-14, AD-1/AD-4).
 *
 * Module PUR : aucun acces reseau, la generation est injectee (`SummaryDeps`),
 * ce qui rend le service testable hors ligne comme `lib/ai/chat.ts`.
 *
 * Modele : `gemini-3.1-flash-lite` — non « pensant », indispensable ici car le
 * SDK epingle (`ai@4.3.19` / `@ai-sdk/google@1.2.22`) ne finalize pas la reponse
 * des modeles pensants (0 caractere recu). Valide en flux le 2026-09-27 (~5 s).
 *
 * Zero-hallucination : le resume ne peut porter que sur le contenu fourni.
 * Aucun stockage : le resume n'entre ni dans `resources` ni dans l'index.
 */

/** Statut de ressource eligible a la synthese (contrainte CHECK en base). */
export const READY_STATUS = "Prête";

/** Modele de generation, cote serveur uniquement. */
export const SUMMARY_MODEL = "gemini-3.1-flash-lite";

/** En dessous, le document ne justifie pas une synthese (0 appel IA). */
export const MIN_SOURCE_CHARS = 400;

/** Plafond de contexte : au-dela, le resume est signale « partiel ». */
export const MAX_SOURCE_CHARS = 12000;

/** Bornes de puces exigees par l'AC (5 a 8). */
export const MIN_BULLETS = 5;
export const MAX_BULLETS = 8;

/** Garde-fou : une puce reste une phrase, pas un paragraphe. */
export const MAX_BULLET_CHARS = 300;

export const SUMMARY_MESSAGES = {
  unauthorized: "Connectez-vous pour résumer un document.",
  notFound: "Document introuvable : il a peut-être été supprimé.",
  notReady:
    "Ce document n'est pas encore prêt : le résumé est disponible une fois l'indexation terminée.",
  tooShort:
    "Ce document ne nécessite pas de synthèse : il est trop court pour en extraire l'essentiel.",
  generationFailure:
    "La synthèse n'a pas pu être générée. Réessayez dans un instant.",
  emptyGeneration:
    "La synthèse est vide. Réessayez dans un instant ou consultez le document complet.",
  partial:
    "Résumé partiel : le document dépasse la limite traitée en une passe. Consultez le document complet pour le détail.",
} as const;

/** Regles systeme : le modele ne doit rien inventer hors du contenu fourni. */
export const SUMMARY_SYSTEM = [
  `Tu es l'assistant interne de NexaWorks. Tu produis la synthèse d'un document.`,
  `Réponds en français, uniquement à partir du contenu fourni.`,
  `Règles strictes :`,
  `- Ne reformule AUCUN fait, chiffre, date ou nom qui n'apparaît pas dans le contenu.`,
  `- Produis entre ${MIN_BULLETS} et ${MAX_BULLETS} puces, une ligne par puce.`,
  `- Chaque ligne commence par « - » et tient en une phrase (${MAX_BULLET_CHARS} caractères maximum).`,
  `- N'ajoute aucun titre, aucun préambule, aucun commentaire final.`,
].join("\n");

export interface SummarySource {
  title: string;
  category: string;
  status: string;
  /** Morceaux du document, deja ordonnes par `chunk_index`. */
  chunks: string[];
}

export interface SummaryDeps {
  /** Generation injectee : `{ system, prompt } -> texte brut`. */
  generate: (input: { system: string; prompt: string }) => Promise<string>;
}

export interface SummaryOutcome {
  ok: boolean;
  /** 5 a 8 puces (ou moins si la source est tres courte). */
  bullets: string[];
  /** true si la source a depasse MAX_SOURCE_CHARS. */
  partial: boolean;
  /** Message FR a afficher ; vide en cas de succes sans troncature. */
  message: string;
}

/** Concatene les morceaux et applique le plafond de contexte. */
export function buildSourceText(chunks: string[]): {
  text: string;
  partial: boolean;
} {
  const joined = (chunks ?? [])
    .map((c) => (c ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  if (joined.length <= MAX_SOURCE_CHARS) return { text: joined, partial: false };
  return { text: joined.slice(0, MAX_SOURCE_CHARS), partial: true };
}

/** Corps de la requete : titre, categorie puis contenu. */
export function buildSummaryPrompt(source: SummarySource): string {
  return [
    `Document : ${source.title}`,
    `Catégorie : ${source.category}`,
    "",
    "Contenu :",
    source.chunks.join("\n\n"),
  ].join("\n");
}

const BULLET_RE = /^\s*(?:[-*•–—]|\d+[.)])\s+(.*)$/;

/**
 * Rend une puce en texte brut : retire l'emphase markdown inline
 * (`**gras**`, `` `code` ``) puis les marqueurs de bord. L'UI affiche la
 * puce telle quelle, sans rendu markdown.
 */
function cleanBullet(text: string): string {
  return text
    .replace(/^#+\s*/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[*_~\s]+/, "")
    .replace(/[*_`~\s]+$/, "")
    .trim();
}

/**
 * Extrait les puces d'une reponse libre.
 * Ignore tout ce qui n'est pas puce (preambule, titre, commentaire) et
 * plafonne a MAX_BULLETS pour garantir l'AC.
 */
export function parseBullets(raw: string): string[] {
  const bullets: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const match = line.match(BULLET_RE);
    if (!match) continue;
    const text = cleanBullet((match[1] ?? "").replace(/\s+/g, " "));
    if (!text) continue;
    bullets.push(text.slice(0, MAX_BULLET_CHARS));
    if (bullets.length >= MAX_BULLETS) break;
  }
  return bullets;
}

/**
 * Pipeline : eligibilite -> bornage -> generation -> puces.
 * Ne leve jamais : renvoie toujours un `SummaryOutcome` exploitable.
 *
 * Tolérance : Gemini peut répondre vide (flux vide observé en production le
 * 2026-09-27, latence 15 s, 0 caractère). Une seule relance est tentée avant
 * de conclure, pour ne pas renvoyer un « aucune puce » alors que le document
 * est parfaitement résumable.
 */
export async function summarizeResource(input: {
  source: SummarySource;
  deps: SummaryDeps;
  attempts?: number;
}): Promise<SummaryOutcome> {
  const { source, deps } = input;
  const maxAttempts = Math.max(1, Math.min(3, Math.floor(input.attempts ?? 2)));

  if ((source.status ?? "").trim() !== READY_STATUS) {
    return { ok: false, bullets: [], partial: false, message: SUMMARY_MESSAGES.notReady };
  }

  const { text, partial } = buildSourceText(source.chunks);
  if (text.length < MIN_SOURCE_CHARS) {
    return { ok: false, bullets: [], partial: false, message: SUMMARY_MESSAGES.tooShort };
  }

  let lastMessage: string = SUMMARY_MESSAGES.emptyGeneration;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw = "";
    try {
      raw = await deps.generate({
        system: SUMMARY_SYSTEM,
        prompt: buildSummaryPrompt({ ...source, chunks: [text] }),
      });
    } catch {
      lastMessage = SUMMARY_MESSAGES.generationFailure;
      continue;
    }
    const bullets = parseBullets(raw);
    if (bullets.length > 0) {
      return {
        ok: true,
        bullets,
        partial,
        message: partial ? SUMMARY_MESSAGES.partial : "",
      };
    }
  }

  return { ok: false, bullets: [], partial, message: lastMessage };
}
