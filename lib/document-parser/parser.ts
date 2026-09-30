/**
 * Parser structurel pour transformer le texte extrait en document de connaissance hiérarchisé.
 * Reconstruit : titre, sous-titre, métadonnées, table des matières, sections, FAQ (Q&A),
 * tableaux, listes et paragraphes, tout en préservant les ancres de citations IA (chunkId).
 */

import { cleanDocumentText, removeChunkOverlap } from "./cleaner.ts";
import type {
  DocumentMetadataItem,
  StructuredBlock,
  StructuredDocument,
  StructuredSection,
  TableBlock,
  TocItem,
  QaBlock,
  ParagraphBlock,
  ListBlock,
} from "./types.ts";

export interface ChunkInput {
  id: string;
  index: number;
  text: string;
  isActive?: boolean;
}

export interface ParseOptions {
  documentTitle: string;
  category?: string;
  chunks: ChunkInput[];
  targetChunkId?: string | null;
}

const KNOWN_METADATA_LABELS: Record<string, string> = {
  référence: "RÉFÉRENCE",
  reference: "RÉFÉRENCE",
  ref: "RÉFÉRENCE",
  version: "VERSION",
  "mise à jour": "MISE À JOUR",
  "mise a jour": "MISE À JOUR",
  date: "MISE À JOUR",
  "dernière mise à jour": "MISE À JOUR",
  propriétaire: "PROPRIÉTAIRE",
  proprietaire: "PROPRIÉTAIRE",
  auteur: "PROPRIÉTAIRE",
  responsable: "PROPRIÉTAIRE",
  owner: "PROPRIÉTAIRE",
  author: "PROPRIÉTAIRE",
  statut: "STATUT",
  status: "STATUT",
  classification: "STATUT",
  confidentialité: "STATUT",
  confidentialite: "STATUT",
};

/**
 * Décompose le titre pour repérer un surtitre / sous-titre élégant.
 * Ex : "FAQ Client — Questions fréquentes" -> surtitle: "FAQ Client", subtitle: "Questions fréquentes"
 */
export function decomposeTitle(rawTitle: string): {
  title: string;
  surtitle?: string;
  subtitle?: string;
} {
  const trimmed = rawTitle.trim();
  const sepMatch = trimmed.match(/^(.+?)\s*(?:—|–|:|-)\s*(.+)$/);
  if (sepMatch) {
    const part1 = sepMatch[1].trim();
    const part2 = sepMatch[2].trim();
    // Si la première partie ressemble à une catégorie ou préfixe court (ex. FAQ Client)
    if (part1.length <= 40 && part2.length > 0) {
      return {
        title: trimmed,
        surtitle: part1,
        subtitle: part2,
      };
    }
  }
  return { title: trimmed };
}

/**
 * Détecte si un groupe de lignes correspond à des métadonnées sous forme de clé / valeur
 * (soit vertical "CLÉ\nVALEUR", soit horizontal "CLÉ : VALEUR").
 */
export function extractMetadata(lines: string[]): {
  metadata: DocumentMetadataItem[];
  remainingLines: string[];
} {
  const metadata: DocumentMetadataItem[] = [];
  const remainingLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Format horizontal : "RÉFÉRENCE : FAQ-CLI-001" ou "VERSION: 1.4"
    const inlineMatch = line.match(/^([a-zA-ZÀ-ÿ\s]{2,25})\s*:\s*(.+)$/);
    if (inlineMatch) {
      const keyCandidate = inlineMatch[1].trim().toLowerCase();
      if (KNOWN_METADATA_LABELS[keyCandidate]) {
        metadata.push({
          key: keyCandidate,
          label: KNOWN_METADATA_LABELS[keyCandidate],
          value: inlineMatch[2].trim(),
        });
        i++;
        continue;
      }
    }

    // Format vertical :
    // RÉFÉRENCE
    // FAQ-CLI-001
    const keyCandidate = line.toLowerCase();
    if (KNOWN_METADATA_LABELS[keyCandidate] && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // La ligne suivante ne doit pas être une autre clé connue, ni un titre de section
      if (nextLine && !KNOWN_METADATA_LABELS[nextLine.toLowerCase()] && !/^\d+\.\s+/.test(nextLine)) {
        metadata.push({
          key: keyCandidate,
          label: KNOWN_METADATA_LABELS[keyCandidate],
          value: nextLine,
        });
        i += 2;
        continue;
      }
    }

    // Dès qu'on tombe sur une ligne non-métadonnée significative, les métadonnées de tête sont terminées
    remainingLines.push(...lines.slice(i));
    break;
  }

  return { metadata, remainingLines };
}

/**
 * Détecte si une ligne représente un tableau Markdown (| col1 | col2 |).
 */
function isTableLine(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

/**
 * Parse un bloc de lignes de tableau Markdown.
 */
function parseTableBlock(id: string, lines: string[], chunkId?: string, isActive?: boolean): TableBlock {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  const rows = cleanLines
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l)) // Exclure le séparateur Markdown |---|---|
    .map((l) =>
      l
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );

  const headers = rows.length > 0 ? rows[0] : [];
  const dataRows = rows.length > 1 ? rows.slice(1) : [];

  return {
    id,
    type: "table",
    headers,
    rows: dataRows,
    chunkId,
    isActive,
  };
}

/**
 * Identifie si une ligne est un titre de section principale (ex. "1. Compte et accès" ou "## Titre").
 */
export function matchSectionHeading(line: string): { title: string; number?: string; level: 2 | 3 } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown H2
  const h2Match = trimmed.match(/^##\s+(.+)$/);
  if (h2Match) {
    return { title: h2Match[1].trim(), level: 2 };
  }

  // Markdown H3
  const h3Match = trimmed.match(/^###\s+(.+)$/);
  if (h3Match) {
    return { title: h3Match[1].trim(), level: 3 };
  }

  // Numéroté : "1. Compte et accès" ou "Section 1 : Compte et accès"
  const numMatch = trimmed.match(/^(?:Section\s+)?(\d+)[.)]\s+(.+)$/i);
  if (numMatch) {
    const num = numMatch[1];
    const rest = numMatch[2].trim();
    // Doit être un intitulé de section raisonnable (pas une longue phrase)
    if (rest.length <= 100 && !/[.!?]$/.test(rest)) {
      return { title: rest, number: num, level: 2 };
    }
  }

  // Éléments en MAJUSCULES isolés représentant des sections majeures
  if (trimmed.length >= 4 && trimmed.length <= 60 && trimmed === trimmed.toUpperCase() && /^[A-ZÀ-ÿ0-9\s—–:-]+$/.test(trimmed)) {
    // Si ce n'est pas une clé de métadonnées
    if (!KNOWN_METADATA_LABELS[trimmed.toLowerCase()]) {
      return { title: trimmed, level: 2 };
    }
  }

  return null;
}

/**
 * Parse un ensemble de blocs textuels au sein d'une section.
 */
function parseBlocks(
  text: string,
  chunkId?: string,
  isActive?: boolean,
  counter: { blockId: number } = { blockId: 1 },
): StructuredBlock[] {
  const blocks: StructuredBlock[] = [];
  const paragraphs = text.split(/\n{2,}/);

  for (let p = 0; p < paragraphs.length; p++) {
    const rawPara = paragraphs[p];
    const para = rawPara.trim();
    if (!para) continue;

    // 1. Détection de tableau Markdown
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.every(isTableLine)) {
      blocks.push(parseTableBlock(`block-${counter.blockId++}`, lines, chunkId, isActive));
      continue;
    }

    // 2. Détection de format FAQ dans le MÊME paragraphe :
    // "Q. Question...\nR. Réponse..."
    const qrCombinedMatch = para.match(
      /^(?:Q[.:]|Question\s*:?)\s*(.+?)\n+(?:R[.:]|Réponse\s*:?|Reponse\s*:?)\s*([\s\S]+)$/i,
    );
    if (qrCombinedMatch) {
      blocks.push({
        id: `block-${counter.blockId++}`,
        type: "qa",
        question: qrCombinedMatch[1].trim(),
        answer: qrCombinedMatch[2].trim(),
        chunkId,
        isActive,
      });
      continue;
    }

    // Question suivie de réponse dans les lignes du même paragraphe
    if (/^(?:Q[.:]|Question\s*:?)\s*(.+)$/i.test(lines[0]) && lines.length > 1) {
      const qLine = lines[0].replace(/^(?:Q[.:]|Question\s*:?)\s*/i, "").trim();
      const rLines = lines.slice(1).map((l) => l.replace(/^(?:R[.:]|Réponse\s*:?|Reponse\s*:?)\s*/i, "")).join(" ");
      if (rLines) {
        blocks.push({
          id: `block-${counter.blockId++}`,
          type: "qa",
          question: qLine,
          answer: rLines.trim(),
          chunkId,
          isActive,
        });
        continue;
      }
    }

    // Question seule dans ce paragraphe avec Réponse dans le paragraphe SUIVANT :
    const isQStart = /^(?:Q[.:]|Question\s*:?)\s*(.+)$/i.test(para);
    const isImplicitQ = para.endsWith("?") && para.length <= 180 && !para.includes("\n");

    if (isQStart || isImplicitQ) {
      const question = para
        .replace(/^(?:Q[.:]|Question\s*:?)\s*/i, "")
        .replace(/^###\s+/, "")
        .trim();

      if (p + 1 < paragraphs.length) {
        const nextPara = paragraphs[p + 1].trim();
        const nextIsR = /^(?:R[.:]|Réponse\s*:?|Reponse\s*:?)\s*/i.test(nextPara);
        const nextIsAnotherQ =
          /^(?:Q[.:]|Question\s*:?)\s*/i.test(nextPara) ||
          (nextPara.endsWith("?") && nextPara.length <= 180 && !nextPara.includes("\n"));
        const nextIsHeading = isTableLine(nextPara) || matchSectionHeading(nextPara) !== null;

        if (nextIsR) {
          const answer = nextPara.replace(/^(?:R[.:]|Réponse\s*:?|Reponse\s*:?)\s*/i, "").trim();
          blocks.push({
            id: `block-${counter.blockId++}`,
            type: "qa",
            question,
            answer,
            chunkId,
            isActive,
          });
          p++; // consomme le paragraphe de réponse
          continue;
        } else if (!nextIsAnotherQ && !nextIsHeading) {
          // Réponse implicite dans le paragraphe suivant
          blocks.push({
            id: `block-${counter.blockId++}`,
            type: "qa",
            question,
            answer: nextPara,
            chunkId,
            isActive,
          });
          p++; // consomme le paragraphe de réponse
          continue;
        }
      }
    }

    // 3. Détection de liste à puces ou numérotée
    const bulletIndexes = lines.map((l, idx) => (/^[-*•–]\s+/.test(l) ? idx : -1)).filter((idx) => idx !== -1);
    if (bulletIndexes.length >= 1 && bulletIndexes[bulletIndexes.length - 1] === lines.length - 1) {
      const firstBullet = bulletIndexes[0];
      if (firstBullet > 0) {
        // Il y a un texte d'introduction avant la liste
        const introText = lines.slice(0, firstBullet).join(" ");
        blocks.push({
          id: `block-${counter.blockId++}`,
          type: "paragraph",
          text: introText,
          chunkId,
          isActive,
        });
      }
      const items = lines.slice(firstBullet).map((l) => l.replace(/^[-*•–]\s+/, "").trim());
      blocks.push({
        id: `block-${counter.blockId++}`,
        type: "list",
        items,
        ordered: false,
        chunkId,
        isActive,
      });
      continue;
    }

    const numIndexes = lines.map((l, idx) => (/^\d+[.)]\s+/.test(l) ? idx : -1)).filter((idx) => idx !== -1);
    if (numIndexes.length >= 2 && numIndexes[numIndexes.length - 1] === lines.length - 1) {
      const firstNum = numIndexes[0];
      if (firstNum > 0) {
        const introText = lines.slice(0, firstNum).join(" ");
        blocks.push({
          id: `block-${counter.blockId++}`,
          type: "paragraph",
          text: introText,
          chunkId,
          isActive,
        });
      }
      const items = lines.slice(firstNum).map((l) => l.replace(/^\d+[.)]\s+/, "").trim());
      blocks.push({
        id: `block-${counter.blockId++}`,
        type: "list",
        items,
        ordered: true,
        chunkId,
        isActive,
      });
      continue;
    }

    // 4. Paragraphe standard
    blocks.push({
      id: `block-${counter.blockId++}`,
      type: "paragraph",
      text: lines.join(" "),
      chunkId,
      isActive,
    });
  }

  return blocks;
}

/**
 * Fonction principale : reconstruit un StructuredDocument riche à partir des morceaux textuels extraits.
 */
export function parseStructuredDocument({
  documentTitle,
  category,
  chunks,
  targetChunkId,
}: ParseOptions): StructuredDocument {
  const { title, surtitle, subtitle } = decomposeTitle(documentTitle);

  // 1. Nettoyage initial et déduplication de chaque morceau
  const cleanedChunks: Array<{ id: string; index: number; text: string; isActive: boolean }> = [];
  let prevText = "";

  for (const chunk of chunks) {
    let clean = cleanDocumentText(chunk.text, documentTitle);
    // Retirer le titre répété au sommet du chunk ajouté par chunkDocument ("# Titre")
    clean = clean.replace(new RegExp(`^#[ \\t]*${documentTitle.trim()}[ \\t]*\\n+`, "i"), "");
    // Retirer les chevauchements avec le chunk précédent
    clean = removeChunkOverlap(prevText, clean);

    const isActive = chunk.id === targetChunkId || Boolean(chunk.isActive);
    cleanedChunks.push({
      id: chunk.id,
      index: chunk.index,
      text: clean,
      isActive,
    });
    prevText = clean;
  }

  // 2. Concaténation logique des lignes avec traçabilité du chunk d'origine
  interface TaggedLine {
    text: string;
    chunkId: string;
    isActive: boolean;
  }

  const allLines: TaggedLine[] = [];
  for (const c of cleanedChunks) {
    const lines = c.text.split("\n");
    for (const line of lines) {
      allLines.push({
        text: line,
        chunkId: c.id,
        isActive: c.isActive,
      });
    }
  }

  // 3. Extraction des métadonnées de tête
  const stringLines = allLines.map((l) => l.text);
  const { metadata, remainingLines } = extractMetadata(stringLines);
  const contentStartIndex = allLines.length - remainingLines.length;
  const contentTaggedLines = allLines.slice(contentStartIndex);

  // 4. Découpage en sections hiérarchisées
  const sections: StructuredSection[] = [];
  let currentSection: StructuredSection = {
    id: "section-0",
    title: "Introduction",
    level: 2,
    blocks: [],
  };

  let sectionCounter = 0;
  let blockCounter = { blockId: 1 };
  let currentChunkLines: string[] = [];
  let currentChunkId = contentTaggedLines[0]?.chunkId;
  let currentChunkIsActive = contentTaggedLines[0]?.isActive ?? false;

  const flushBlocks = () => {
    if (currentChunkLines.length > 0) {
      const textToParse = currentChunkLines.join("\n").trim();
      if (textToParse) {
        const blocks = parseBlocks(textToParse, currentChunkId, currentChunkIsActive, blockCounter);
        currentSection.blocks.push(...blocks);
      }
      currentChunkLines = [];
    }
  };

  for (const item of contentTaggedLines) {
    const heading = matchSectionHeading(item.text);

    if (heading) {
      flushBlocks();
      // Si la section précédente a du contenu, on la sauvegarde
      if (currentSection.blocks.length > 0 || currentSection.id !== "section-0") {
        sections.push(currentSection);
      }

      sectionCounter++;
      currentSection = {
        id: `section-${sectionCounter}`,
        title: heading.title,
        number: heading.number,
        level: heading.level,
        chunkId: item.chunkId,
        isActive: item.isActive,
        blocks: [],
      };
      currentChunkId = item.chunkId;
      currentChunkIsActive = item.isActive;
      continue;
    }

    // Changement de chunk pour attribution des citations
    if (item.chunkId !== currentChunkId) {
      flushBlocks();
      currentChunkId = item.chunkId;
      currentChunkIsActive = item.isActive;
    }

    currentChunkLines.push(item.text);
  }

  flushBlocks();
  if (currentSection.blocks.length > 0 || sections.length === 0) {
    sections.push(currentSection);
  }

  // Nettoyage : si la section 0 ("Introduction") est vide et qu'il y a d'autres sections, on l'enlève
  const finalSections = sections.filter((s) => s.blocks.length > 0 || s.id !== "section-0");

  // 5. Génération de la table des matières (TOC)
  // Recommandation : uniquement si 2 sections ou plus identifiées
  const tableOfContents: TocItem[] = [];
  if (finalSections.length >= 2) {
    for (const sec of finalSections) {
      if (sec.title && sec.title !== "Introduction") {
        tableOfContents.push({
          id: sec.id,
          title: sec.number ? `${sec.number}. ${sec.title}` : sec.title,
          level: sec.level,
        });
      }
    }
  }

  // 6. Détection si le document est majoritairement une FAQ
  let totalBlocks = 0;
  let qaBlocks = 0;
  for (const s of finalSections) {
    for (const b of s.blocks) {
      totalBlocks++;
      if (b.type === "qa") qaBlocks++;
    }
  }
  const isFaq = (qaBlocks >= 2 && qaBlocks / (totalBlocks || 1) >= 0.3) || /FAQ|Questions fréquentes/i.test(title);

  return {
    title,
    surtitle,
    subtitle,
    metadata,
    tableOfContents,
    sections: finalSections,
    isFaq,
    totalChars: cleanedChunks.reduce((acc, c) => acc + c.text.length, 0),
  };
}
