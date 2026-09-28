// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests de la vue de consultation (story 6.1, FR-8/FR-9/FR-11).
 * Execute avec `npm run test:resource-view` : aucun reseau, aucun React.
 * Une assertion par ligne de la matrice I/O du plan + audits de securite.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_VIEW_CHARS,
  buildDocumentView,
  formatChunkPosition,
} from "../lib/resources/view.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

/** Trois morceaux volontairement dans le desordre : l'ordre de lecture prime. */
const ROWS = [
  { id: "c2", chunk_index: 2, content: "troisieme passage" },
  { id: "c0", chunk_index: 0, content: "premier passage" },
  { id: "c1", chunk_index: 1, content: "deuxieme passage" },
];

describe("buildDocumentView", () => {
  it("HAPPY_PATH : ordre de lecture, contenu conserve, ancre marquee", () => {
    const view = buildDocumentView(ROWS, { targetChunkId: "c1" });
    assert.deepEqual(view.chunks.map((c) => c.id), ["c0", "c1", "c2"]);
    assert.deepEqual(view.chunks.map((c) => c.index), [0, 1, 2]);
    assert.equal(view.chunks[1].text, "deuxieme passage");
    assert.equal(view.hasAnchor, true);
    assert.equal(view.chunks.filter((c) => c.isActive).length, 1);
    assert.equal(view.truncated, false);
    assert.equal(view.totalChunks, 3);
  });

  it("SEARCH_JUMP / CITATION_JUMP : l'ancre demandee est la seule active", () => {
    for (const target of ["c0", "c2"]) {
      const view = buildDocumentView(ROWS, { targetChunkId: target });
      const active = view.chunks.filter((c) => c.isActive);
      assert.equal(active.length, 1);
      assert.equal(active[0].id, target);
      assert.equal(view.hasAnchor, true);
    }
  });

  it("NO_CHUNKS : aucune ligne -> vue vide exploitable", () => {
    for (const input of [[], null, undefined, [null, 42, {}]]) {
      const view = buildDocumentView(input);
      assert.deepEqual(view.chunks, []);
      assert.equal(view.totalChunks, 0);
      assert.equal(view.hasAnchor, false);
    }
  });

  it("BAD_ANCHOR : ancre absente, vide ou inconnue -> aucun surlignage", () => {
    for (const target of [undefined, null, "", "   ", "inconnu"]) {
      const view = buildDocumentView(ROWS, { targetChunkId: target });
      assert.equal(view.hasAnchor, false, `ancre ${JSON.stringify(target)}`);
      assert.equal(view.chunks.filter((c) => c.isActive).length, 0);
      assert.equal(view.chunks.length, 3);
    }
  });

  it("HUGE_DOC : la troncature est signalee, jamais silencieuse", () => {
    const gros = Array.from({ length: 5 }, (_, i) => ({
      id: `g${i}`,
      chunk_index: i,
      content: "x".repeat(40),
    }));
    const view = buildDocumentView(gros, { maxChars: 100 });
    assert.equal(view.truncated, true);
    assert.ok(view.chars <= 100, `rendu ${view.chars} caracteres`);
    assert.equal(view.totalChunks, 5, "le total reste connu meme tronque");
    // L'ancre d'un passage hors rendu ne doit pas produire de faux surlignage.
    const vue = buildDocumentView(gros, { maxChars: 100, targetChunkId: "g4" });
    assert.equal(vue.hasAnchor, false);
  });

  it("un morceau sans chunk_index garde sa position de lecture", () => {
    const view = buildDocumentView([
      { id: "a", content: "A" },
      { id: "b", chunk_index: 5, content: "B" },
    ]);
    assert.deepEqual(view.chunks.map((c) => c.id), ["a", "b"]);
    assert.equal(view.chunks[1].index, 5);
  });

  it("le plafond par defaut est documente et borne", () => {
    assert.equal(MAX_VIEW_CHARS, 120_000);
    const view = buildDocumentView([
      { id: "big", chunk_index: 0, content: "x".repeat(MAX_VIEW_CHARS + 10) },
    ]);
    assert.equal(view.truncated, true);
    assert.equal(view.chars, MAX_VIEW_CHARS);
  });
});

describe("formatChunkPosition", () => {
  it("libelle la position en base 1", () => {
    assert.equal(formatChunkPosition(0, 6), "Passage 1 / 6");
    assert.equal(formatChunkPosition(5, 6), "Passage 6 / 6");
  });
});

describe("audits de securite et d'integration (statique)", () => {
  const fiche = read("app/(dashboard)/resources/[id]/page.tsx");

  it("aucun HTML brut : ni dangerouslySetInnerHTML ni innerHTML", () => {
    for (const file of [
      "app/(dashboard)/resources/[id]/page.tsx",
      "lib/resources/view.ts",
      "components/resources/chunk-anchor.tsx",
    ]) {
      const src = read(file);
      assert.ok(
        !/dangerouslySetInnerHTML|innerHTML/.test(src),
        `${file} rend du HTML brut`,
      );
    }
  });

  it("l'ancre vient bien de searchParams.chunk et est posee par le serveur", () => {
    assert.match(fiche, /searchParams\?: Promise<\{ chunk\?: string \| string\[\] \}>/);
    assert.match(fiche, /targetChunkId = typeof rawChunk === "string"/);
    assert.match(fiche, /data-active=\{chunk\.isActive \? "true" : "false"\}/);
  });

  it("le contenu est lu dans l'ordre de lecture et borne par le helper", () => {
    assert.match(fiche, /from\("document_chunks"\)/);
    assert.match(fiche, /order\("chunk_index", \{ ascending: true \}\)/);
    assert.match(fiche, /buildDocumentView\(chunks \?\? \[\], \{ targetChunkId \}\)/);
  });

  it("le passage actif est annonce, pas seulement colore (accesibilite)", () => {
    assert.match(fiche, /aria-current=\{chunk\.isActive \? "true" : undefined\}/);
    assert.match(fiche, /Passage cité/);
  });

  it("la mention de troncature ne promet aucun lien inexistant", () => {
    assert.match(fiche, /seule une partie du contenu est affichée/);
    assert.ok(
      !/Ouvrez le fichier pour la version complète/.test(fiche),
      "la fiche ne propose pas de lien vers le fichier : ne pas l'annoncer",
    );
  });

  it("le lien de recherche porte l'ancre du morceau (FR-8/FR-9)", () => {
    const search = read("components/search/search-client.tsx");
    assert.match(
      search,
      /\/resources\/\$\{r\.resourceId\}\$\{r\.chunkId \? `\?chunk=\$\{r\.chunkId\}` : ""\}/,
    );
  });

  it("le tiroir de citation mene au passage cite (FR-11)", () => {
    const chat = read("components/chat/chat-client.tsx");
    assert.match(
      chat,
      /\/resources\/\$\{openCitation\.citation\.sourceId\}\?chunk=\$\{openCitation\.citation\.chunkId\}/,
    );
    assert.match(chat, /openCitation\.citation\.chunkId \? \(/);
  });

  it("le defilement vers l'ancre est le seul JavaScript de la fiche", () => {
    const anchor = read("components/resources/chunk-anchor.tsx");
    assert.match(anchor, /data-active="true"/);
    assert.match(anchor, /scrollIntoView/);
    // Un seul effet (l'import de useEffect n'est pas un appel).
    assert.equal((anchor.match(/useEffect\(/g) ?? []).length, 1);
    assert.equal((anchor.match(/<script|innerHTML|dangerouslySetInnerHTML/g) ?? []).length, 0);
  });
});

