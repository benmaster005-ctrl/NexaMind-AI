/**
 * Découpage documentaire (story 2.2, FR-6 / architecture AD-3).
 *
 * Module pur : ni Next, ni Supabase, ni réseau — testé par
 * `npm run test:ingestion` (node --test). Règles :
 * - fenêtre de 400 à 500 tokens estimés par morceau ;
 * - chevauchement d'environ 50 tokens entre morceaux consécutifs ;
 * - titre du document rappelé en tête de chaque morceau ;
 * - chaque morceau porte l'identifiant de sa ressource parente et son index.
 *
 * La mesure des tokens est une estimation déterministe (~4 caractères par
 * token, moyenne usuelle pour du texte latin) : elle est la source de vérité
 * unique de ce module (décision du 2026-09-27, aucun tokenizer Gemini hors
 * ligne ; story 2.3 gardera Gemini pour les vecteurs).
 */

/** Borne basse de la fenêtre pour tout morceau non final. */
export const CHUNK_MIN_TOKENS = 400;
/** Borne haute absolue : aucun morceau ne la dépasse. */
export const CHUNK_MAX_TOKENS = 500;
/** Chevauchement visé entre deux morceaux consécutifs (AD-3). */
export const CHUNK_OVERLAP_TOKENS = 50;
/**
 * Taille maximale d'une unité atomique (phrase ou fragment de phrase).
 * Elle garantit la borne basse : un morceau n'est fermé que lorsque l'unité
 * suivante ferait dépasser CHUNK_MAX_TOKENS, donc à plus de
 * CHUNK_MAX_TOKENS - CHUNK_UNIT_MAX_TOKENS tokens.
 */
export const CHUNK_UNIT_MAX_TOKENS = 90;

const CHARS_PER_TOKEN = 4;

export interface DocumentChunk {
  /** Ressource parente (colonne document_chunks.resource_id). */
  resourceId: string;
  /** Index d'ordre du morceau dans le document (0-based). */
  chunkIndex: number;
  /** Contenu stocké : titre du document puis corps du morceau. */
  content: string;
  /** Nombre de tokens estimés du contenu. */
  tokens: number;
}

export interface ChunkDocumentInput {
  resourceId: string;
  title: string;
  text: string;
}

interface Unit {
  text: string;
  /** Séparateur précédant l'unité : "\n\n" paragraphe, "\n" ligne, " " phrase. */
  separator: string;
}

/** Estimation déterministe du nombre de tokens (~4 caractères par token). */
export function estimateTokens(text: string): number {
  const length = text.trim().length;
  return length === 0 ? 0 : Math.ceil(length / CHARS_PER_TOKEN);
}

/** Normalise le texte extrait sans en altérer le contenu. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitByChars(text: string, maxTokens: number): string[] {
  const size = Math.max(1, maxTokens) * CHARS_PER_TOKEN;
  const parts: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    parts.push(text.slice(index, index + size));
  }
  return parts;
}

/** Réduit une unité trop longue (phrase fleuve, ligne de tableau, URL). */
function splitUnitText(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    const candidate =
      current.length === 0 ? word : `${current.join(" ")} ${word}`;
    if (current.length > 0 && estimateTokens(candidate) > maxTokens) {
      parts.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) parts.push(current.join(" "));

  // Un mot insécable plus long que la fenêtre est coupé en dur.
  return parts.flatMap((part) =>
    estimateTokens(part) <= maxTokens ? [part] : splitByChars(part, maxTokens),
  );
}

/** Découpe le texte en unités : paragraphe -> ligne -> phrase -> fragment. */
function splitIntoUnits(text: string, unitMaxTokens: number): Unit[] {
  const units: Unit[] = [];

  text.split(/\n{2,}/).forEach((paragraph) => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) return;

    trimmedParagraph.split("\n").forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const sentences = trimmedLine.split(/(?<=[.!?…])\s+/).filter(Boolean);
      sentences.forEach((sentence, sentenceIndex) => {
        const parts = splitUnitText(sentence.trim(), unitMaxTokens);
        parts.forEach((part, partIndex) => {
          // "\n\n" entre paragraphes, "\n" entre lignes (listes conservées),
          // " " entre phrases et fragments.
          const separator =
            partIndex > 0 || sentenceIndex > 0
              ? " "
              : lineIndex > 0
                ? "\n"
                : "\n\n";
          units.push({ text: part, separator });
        });
      });
    });
  });

  return units;
}

/** Derniers mots couvrant au moins `tokenBudget` tokens (aligné sur un mot). */
function tailByTokens(text: string, tokenBudget: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tail: string[] = [];
  for (let index = words.length - 1; index >= 0; index -= 1) {
    tail.unshift(words[index]);
    if (estimateTokens(tail.join(" ")) >= tokenBudget) break;
  }
  return tail.join(" ");
}

/** Fusionne une queue trop courte avec le morceau précédent si la borne haute le permet. */
function mergeShortTail(bodies: string[], header: string): void {
  if (bodies.length < 2) return;
  const last = bodies[bodies.length - 1];
  if (estimateTokens(`${header}\n\n${last}`) >= CHUNK_MIN_TOKENS) return;
  const previous = bodies[bodies.length - 2];
  if (estimateTokens(`${header}\n\n${previous}\n\n${last}`) > CHUNK_MAX_TOKENS) {
    return;
  }
  bodies.splice(bodies.length - 2, 2, `${previous}\n\n${last}`);
}

/**
 * Découpe un document en morceaux de 400 à 500 tokens estimés (AD-3).
 * Seul le dernier morceau peut être plus court (fin de document).
 */
export function chunkDocument({
  resourceId,
  title,
  text,
}: ChunkDocumentInput): DocumentChunk[] {
  const normalized = normalizeText(text);
  const header = `# ${title.trim()}`;
  // La borne basse du morceau dépend de la taille du titre conservé :
  // une unité trop grosse ne doit pas pouvoir fermer un morceau sous 400 tokens.
  const unitMaxTokens = Math.max(
    20,
    Math.min(
      CHUNK_UNIT_MAX_TOKENS,
      CHUNK_MAX_TOKENS - CHUNK_MIN_TOKENS - estimateTokens(header) - 2,
    ),
  );
  const bodies: string[] = [];
  let body = "";

  for (const unit of splitIntoUnits(normalized, unitMaxTokens)) {
    const piece = `${unit.separator}${unit.text}`;
    const candidate = `${header}\n\n${(body + piece).trim()}`;

    if (body.trim() !== "" && estimateTokens(candidate) > CHUNK_MAX_TOKENS) {
      bodies.push(body.trim());
      const overlap = tailByTokens(body, CHUNK_OVERLAP_TOKENS);
      body = overlap ? `\n\n${overlap}` : "";
    }
    body += piece;
  }
  if (body.trim() !== "") bodies.push(body.trim());
  mergeShortTail(bodies, header);

  return bodies.map((chunkBody, chunkIndex) => {
    const content = `${header}\n\n${chunkBody}`;
    return { resourceId, chunkIndex, content, tokens: estimateTokens(content) };
  });
}

