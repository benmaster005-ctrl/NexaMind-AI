// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit du découpage et de l'extraction (plan 2.2, FR-6 / AD-3).
 * Exécuté avec `npm run test:ingestion` (node --test, sans réseau).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CHUNK_MAX_TOKENS,
  CHUNK_MIN_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  chunkDocument,
  estimateTokens,
  normalizeText,
} from "../lib/ai/chunking.ts";
import {
  EXTRACTION_MESSAGES,
  ExtractionError,
  extractText,
} from "../lib/ai/extraction.ts";

const TITLE = "Procedure conges payes";

/** Document synthétique : phrases distinctes regroupées en paragraphes. */
function buildText(sentences: number, perParagraph = 5): string {
  const paragraphs: string[] = [];
  for (let start = 0; start < sentences; start += perParagraph) {
    const group: string[] = [];
    for (let index = start; index < Math.min(start + perParagraph, sentences); index += 1) {
      group.push(
        `Phrase ${index} : les procedures internes decrivent le circuit de validation des demandes.`,
      );
    }
    paragraphs.push(group.join(" "));
  }
  return paragraphs.join("\n\n");
}

/** Corps d'un morceau (sans l'entete de titre). */
function bodyOf(content: string): string {
  const marker = content.indexOf("\n\n");
  return marker < 0 ? content : content.slice(marker + 2);
}

/** Tokens partages entre la fin d'un morceau et le début du suivant. */
function overlapTokens(previousContent: string, nextContent: string): number {
  const previousWords = bodyOf(previousContent).split(/\s+/);
  const nextWords = bodyOf(nextContent).split(/\s+/);
  const max = Math.min(previousWords.length, nextWords.length);
  let matched = 0;
  for (let length = 1; length <= max; length += 1) {
    const suffix = previousWords.slice(previousWords.length - length).join(" ");
    const prefix = nextWords.slice(0, length).join(" ");
    if (suffix === prefix) matched = length;
  }
  return matched === 0
    ? 0
    : estimateTokens(previousWords.slice(previousWords.length - matched).join(" "));
}

async function expectExtractionCode(
  fn: () => Promise<unknown>,
  code: string,
): Promise<ExtractionError> {
  try {
    await fn();
  } catch (error) {
    assert.ok(error instanceof ExtractionError, `ExtractionError attendue, reçu ${error}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`ExtractionError attendue avec le code ${code}`);
}

describe("estimateur de tokens (plan 2.2)", () => {
  it("renvoie 0 pour un texte vide et croît avec la longueur", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("   \n  "), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
    assert.ok(estimateTokens("abcdefgh") > estimateTokens("abcd"));
  });
});

describe("normalisation du texte extrait", () => {
  it("retire le BOM, uniformise les sauts de ligne et borne les blancs", () => {
    const normalized = normalizeText("\uFEFFTitre\r\n\r\n\r\nLigne  avec espaces   \nFin");
    assert.ok(!normalized.startsWith("\uFEFF"));
    assert.ok(!normalized.includes("\r"));
    assert.ok(!normalized.includes("\n\n\n"));
    assert.ok(!normalized.includes("   \n"));
    assert.ok(normalized.includes("Titre\n\nLigne  avec espaces\nFin"));
  });
});

describe("découpage en morceaux de 400-500 tokens (AD-3)", () => {
  const chunks = chunkDocument({
    resourceId: "res-1",
    title: TITLE,
    text: buildText(400),
  });

  it("produit plusieurs morceaux portant tous le titre du document", () => {
    assert.ok(chunks.length > 2, `morceaux attendus > 2, reçu ${chunks.length}`);
    for (const chunk of chunks) {
      assert.ok(
        chunk.content.startsWith(`# ${TITLE}\n\n`),
        `titre absent du morceau ${chunk.chunkIndex}`,
      );
    }
  });

  it("respecte la fenêtre 400-500 tokens (hors dernier morceau)", () => {
    for (const chunk of chunks) {
      assert.ok(
        chunk.tokens <= CHUNK_MAX_TOKENS,
        `morceau ${chunk.chunkIndex} trop long : ${chunk.tokens} tokens`,
      );
      if (chunk.chunkIndex < chunks.length - 1) {
        assert.ok(
          chunk.tokens >= CHUNK_MIN_TOKENS,
          `morceau ${chunk.chunkIndex} trop court : ${chunk.tokens} tokens`,
        );
      }
    }
  });

  it("chevauche d'environ 50 tokens entre deux morceaux consécutifs", () => {
    for (let index = 0; index < chunks.length - 1; index += 1) {
      const overlap = overlapTokens(
        chunks[index].content,
        chunks[index + 1].content,
      );
      if (index === chunks.length - 2 && overlap === 0) continue; // queue fusionnée
      assert.ok(
        overlap >= CHUNK_OVERLAP_TOKENS && overlap <= CHUNK_OVERLAP_TOKENS + 20,
        `chevauchement ${overlap} hors tolérance entre ${index} et ${index + 1}`,
      );
    }
  });

  it("rattache chaque morceau à sa ressource avec un index d'ordre croissant", () => {
    chunks.forEach((chunk, index) => {
      assert.equal(chunk.resourceId, "res-1");
      assert.equal(chunk.chunkIndex, index);
    });
  });

  it("conserve le contenu : titres internes et listes intacts", () => {
    const result = chunkDocument({
      resourceId: "res-2",
      title: TITLE,
      text: "# Section 1\n\n- point un\n- point deux\n\nTexte final du document de reference.",
    });
    assert.equal(result.length, 1);
    assert.ok(result[0].content.includes("- point un\n- point deux"));
    assert.ok(result[0].content.includes("Texte final du document de reference."));
  });

  it("découpe les phrases fleuves sans dépasser la borne haute", () => {
    const long = `${"mot ".repeat(900)}fin.`;
    const result = chunkDocument({
      resourceId: "res-3",
      title: TITLE,
      text: long,
    });
    assert.ok(result.length > 1);
    for (const chunk of result) {
      assert.ok(chunk.tokens <= CHUNK_MAX_TOKENS);
    }
  });


describe("extraction de texte des documents déposés (FR-6)", () => {
  it("lit un TXT avec BOM et retours Windows", async () => {
    const bytes = new TextEncoder().encode(
      "\uFEFFNote interne\r\n\r\nLe depot fonctionne correctement pour les fichiers texte.",
    );
    const result = await extractText({ data: bytes, fileName: "note.txt" });
    assert.equal(result.format, "text");
    assert.ok(!result.text.includes("\r"));
    assert.ok(result.text.startsWith("Note interne"));
  });

  it("accepte le Markdown", async () => {
    const bytes = new TextEncoder().encode("# Guide\n\nContenu du guide interne.");
    const result = await extractText({ data: bytes, fileName: "GUIDE.MD" });
    assert.equal(result.format, "text");
  });

  it("rejette un format non supporté par l'ingestion", async () => {
    const error = await expectExtractionCode(
      () => extractText({ data: new Uint8Array([1]), fileName: "photo.png" }),
      "unsupported-format",
    );
    assert.equal(error.message, EXTRACTION_MESSAGES.unsupported);
  });

  it("refuse un PDF scanné (aucun texte extractible)", async () => {
    const error = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "scan.pdf",
          readers: { pdf: async () => ({ text: "  \n ", pages: 3 }) },
        }),
      "scanned-pdf",
    );
    assert.equal(error.message, EXTRACTION_MESSAGES.scanned);
  });

  it("refuse un PDF trop long", async () => {
    const error = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "gros.pdf",
          readers: { pdf: async () => ({ text: "a".repeat(600), pages: 500 }) },
        }),
      "too-many-pages",
    );
    assert.equal(error.message, EXTRACTION_MESSAGES.tooManyPages);
  });

  it("signale un fichier corrompu sans faire planter le service", async () => {
    const pdf = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "casse.pdf",
          readers: {
            pdf: async () => {
              throw new Error("Invalid PDF structure");
            },
          },
        }),
      "corrupted",
    );
    assert.equal(pdf.message, EXTRACTION_MESSAGES.corrupted);

    const docx = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "casse.docx",
          readers: {
            docx: async () => {
              throw new Error("End of data reached");
            },
          },
        }),
      "corrupted",
    );
    assert.equal(docx.message, EXTRACTION_MESSAGES.corrupted);
  });

  it("signale un document vide", async () => {
    const txt = await expectExtractionCode(
      () =>
        extractText({
          data: new TextEncoder().encode("   \n"),
          fileName: "vide.txt",
        }),
      "empty",
    );
    assert.equal(txt.message, EXTRACTION_MESSAGES.empty);

    const docx = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "vide.docx",
          readers: { docx: async () => "   " },
        }),
      "empty",
    );
    assert.equal(docx.message, EXTRACTION_MESSAGES.empty);
  });

  it("extrait le texte d'un DOCX valide", async () => {
    const result = await extractText({
      data: new Uint8Array([1]),
      fileName: "compte-rendu.docx",
      readers: { docx: async () => "Compte rendu de reunion interne." },
    });
    assert.equal(result.format, "docx");
    assert.equal(result.text, "Compte rendu de reunion interne.");
  });

  it("conserve le code d'une erreur d'ingestion levée par un lecteur", async () => {
    const error = await expectExtractionCode(
      () =>
        extractText({
          data: new Uint8Array([1]),
          fileName: "enorme.pdf",
          readers: {
            pdf: async () => {
              throw new ExtractionError(
                "too-many-pages",
                EXTRACTION_MESSAGES.tooManyPages,
              );
            },
          },
        }),
      "too-many-pages",
    );
    assert.equal(error.message, EXTRACTION_MESSAGES.tooManyPages);
  });
});

describe("titre long (limite du formulaire 2.1 : 200 caractères)", () => {
  it("tient encore la borne basse de 400 tokens", () => {
    const result = chunkDocument({
      resourceId: "res-5",
      title: "T".repeat(200),
      text: buildText(400),
    });

    assert.ok(result.length > 2, `morceaux attendus > 2, reçu ${result.length}`);
    result.slice(0, -1).forEach((chunk) => {
      assert.ok(
        chunk.tokens >= CHUNK_MIN_TOKENS,
        `morceau ${chunk.chunkIndex} trop court avec un titre long : ${chunk.tokens}`,
      );
      assert.ok(chunk.tokens <= CHUNK_MAX_TOKENS);
    });
  });
});

  it("retourne une liste vide pour un texte vide", () => {
    assert.deepEqual(
      chunkDocument({ resourceId: "res-4", title: TITLE, text: "   \n\n " }),
      [],
    );
  });
});

