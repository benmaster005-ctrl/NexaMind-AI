/**
 * Module pur de nettoyage et de normalisation des textes extraits de documents (PDF, DOCX, TXT, MD).
 * Élimine les artefacts de mise en page (numéros de page, en-têtes/pieds de page répétitifs,
 * césures artificielles, chevauchements de chunking) sans jamais inventer ni altérer le sens.
 */

/**
 * Supprime les numéros de page et mentions de passages (ex. "Page 1 / 2", "Passage 2 / 2").
 */
export function removePageNumbers(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      // "Page 1 / 2", "Page 1 sur 2", "Passage 1 / 2", "Passage 2 sur 2"
      if (/^(?:Page|Passage)\s+\d+(?:\s*(?:\/|sur)\s*\d+)?$/i.test(trimmed)) return false;
      // "1 / 2" ou "2 / 2" seul sur une ligne
      if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

/**
 * Supprime les en-têtes / pieds de page répétitifs ou mentions documentaires récurrentes.
 */
export function removeRepetitiveArtifacts(text: string, title?: string): string {
  let cleaned = text;

  // Si le titre exact est répété sous forme "# Titre" ou "Titre" sur une ligne isolée
  if (title && title.trim().length > 3) {
    const escapedTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRegex = new RegExp(`(?:^|\\n)[ \\t]*(?:#[ \\t]*)?${escapedTitle}[ \\t]*(?:\\n|$)`, "gi");
    // Conserver seulement la première occurrence si au tout début, ou retirer les répétitions
    let occurrence = 0;
    cleaned = cleaned.replace(titleRegex, (match) => {
      occurrence++;
      // On retire toutes les récurrences suivantes
      return occurrence === 1 ? match : "\n";
    });
  }

  // Mentions d'en-tête / pied de page communes
  cleaned = cleaned
    .replace(/(?:^|\n)[ \t]*(?:Confidentiel|Document interne|Strictement confidentiel)[ \t]*(?:\n|$)/gi, "\n")
    .replace(/(?:^|\n)[ \t]*(?:Tous droits réservés|All rights reserved)[ \t]*(?:\n|$)/gi, "\n");

  return cleaned;
}

/**
 * Vérifie si une ligne est le début d'un élément structurel (ne doit pas être fusionnée avec la précédente).
 */
function isStructuralStart(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Titres Markdown (#, ##, ###)
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // Listes à puces (-, *, •, –)
  if (/^[-*•–]\s+/.test(trimmed)) return true;

  // Listes numérotées (1., 2., 1), a))
  if (/^\d+[.)]\s+/.test(trimmed) || /^[a-zA-Z][.)]\s+/.test(trimmed)) return true;

  // Questions / Réponses FAQ
  if (/^(?:Q\.|R\.|Q:|R:|Question\s*:?|Réponse\s*:?|Reponse\s*:?)/i.test(trimmed)) return true;

  // Ligne de tableau (| col | col |)
  if (/^\|.*\|$/.test(trimmed)) return true;

  // Clés de métadonnées communes (RÉFÉRENCE, VERSION, STATUT, etc.)
  if (/^(?:RÉFÉRENCE|REFERENCE|VERSION|MISE À JOUR|DATE|PROPRIÉTAIRE|AUTEUR|STATUT|CLASSIFICATION)(?:\s*[:\s]|$)/i.test(trimmed)) return true;

  // Début de citation (> ) ou bloc de code (```)
  if (/^(?:>|```)/.test(trimmed)) return true;

  return false;
}

/**
 * Vérifie si une ligne se termine par un caractère qui indique la fin d'une phrase ou d'un bloc.
 */
function isTerminalLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /[.!?…:;]$/.test(trimmed) || /^#{1,6}\s+/.test(trimmed) || /^\|.*\|$/.test(trimmed);
}

/**
 * Reconstruit les phrases coupées entre plusieurs lignes par les retours à la ligne du PDF.
 * Exemple : "la création est gratuite et ne nécessite pas de carte\nbancaire."
 * devient : "la création est gratuite et ne nécessite pas de carte bancaire."
 */
export function unbreakSentences(text: string): string {
  // Découpe d'abord par doubles retours à la ligne (vrais paragraphes)
  const paragraphs = text.split(/\n{2,}/);

  const processedParagraphs = paragraphs.map((para) => {
    const lines = para.split("\n");
    if (lines.length <= 1) return para.trim();

    const mergedLines: string[] = [];
    let currentLine = lines[0].trim();

    for (let i = 1; i < lines.length; i++) {
      const nextLine = lines[i].trim();
      if (!nextLine) continue;

      const currentEndsWithHyphen = currentLine.endsWith("-") && !currentLine.endsWith(" -");
      const nextIsStructural = isStructuralStart(nextLine);
      const currentIsStructural = isStructuralStart(currentLine);
      const currentIsTerminal = isTerminalLine(currentLine);

      if (!nextIsStructural && !currentIsTerminal && !currentIsStructural) {
        // C'est une continuation de phrase !
        if (currentEndsWithHyphen) {
          // Mot coupé par trait d'union (ex. "colla-\nborateurs" -> "collaborateurs")
          currentLine = currentLine.slice(0, -1) + nextLine;
        } else {
          currentLine = `${currentLine} ${nextLine}`;
        }
      } else {
        mergedLines.push(currentLine);
        currentLine = nextLine;
      }
    }
    mergedLines.push(currentLine);

    return mergedLines.join("\n");
  });

  return processedParagraphs.filter(Boolean).join("\n\n");
}

/**
 * Détecte et élimine les chevauchements (overlaps de chunking) entre deux blocs consécutifs.
 */
export function removeChunkOverlap(prevText: string, currentText: string): string {
  if (!prevText || !currentText) return currentText;

  // On cherche une sous-chaîne commune significative (au moins 20 caractères) à la fin de prevText et au début de currentText
  const prevTail = prevText.trim().slice(-300);
  const currentTrimmed = currentText.trim();

  for (let len = Math.min(250, currentTrimmed.length); len >= 25; len--) {
    const candidate = currentTrimmed.slice(0, len);
    if (prevTail.endsWith(candidate)) {
      return currentTrimmed.slice(len).trim();
    }
  }

  return currentText;
}

/**
 * Pipeline complet de nettoyage pour le texte extrait d'un document.
 */
export function cleanDocumentText(raw: string, title?: string): string {
  if (!raw) return "";

  // 1. Normalisation de base des retours chariot et caractères invisibles
  let text = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n");

  // 2. Suppression des numéros de pages et passages
  text = removePageNumbers(text);

  // 3. Suppression des artefacts répétitifs
  text = removeRepetitiveArtifacts(text, title);

  // 4. Reconstitution des phrases brisées
  text = unbreakSentences(text);

  // 5. Nettoyage des espaces multiples
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
