// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests purs de l'UI de recherche (plan 3.3, FR-8).
 * Execute avec `npm run test:search-ui` : sans reseau, sans Next.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALL_CATEGORY_LABEL,
  SEARCH_UI_MESSAGES,
  buildSearchUrl,
  highlightParts,
  truncateExcerpt,
} from "../lib/search/ui.ts";

describe("search ui (plan 3.3)", () => {
  it("highlight : decoupe insensible a la casse, sans regex", () => {
    const parts = highlightParts("Politique de Teletravail interne", "teletravail");
    assert.deepEqual(parts, [
      { text: "Politique de ", hit: false },
      { text: "Teletravail", hit: true },
      { text: " interne", hit: false },
    ]);
  });

  it("highlight : requete vide et caracteres speciaux sans crash", () => {
    assert.deepEqual(highlightParts("abc", "   "), [{ text: "abc", hit: false }]);
    const parts = highlightParts("a+b (c) ? x", "b (c) ?");
    assert.equal(parts.some((p) => p.hit), true);
    assert.equal(parts.filter((p) => p.hit).length, 1);
  });

  it("url : Tous omis, categorie encodee, limite incluse", () => {
    const all = buildSearchUrl("conges payes", ALL_CATEGORY_LABEL, 10);
    assert.ok(all.startsWith("/api/search?"));
    assert.ok(all.includes("q=conges+payes") || all.includes("q=conges%20payes"));
    assert.ok(!all.includes("category="));
    const faq = buildSearchUrl("guide", "Note de r\u00e9union", 10);
    assert.ok(faq.includes("category="));
    assert.ok(faq.includes("limit=10"));
  });

  it("truncate : ne coupe pas un mot, messages FR definis", () => {
    assert.equal(truncateExcerpt("court texte"), "court texte");
    const long = `${"mot ".repeat(80)}fin`;
    const cut = truncateExcerpt(long, 220);
    assert.ok(cut.length <= 221);
    assert.ok(cut.endsWith("\u2026"));
    assert.ok(SEARCH_UI_MESSAGES.emptyQuery.length > 0);
    assert.ok(SEARCH_UI_MESSAGES.noResults.length > 0);
    assert.ok(SEARCH_UI_MESSAGES.networkError.length > 0);
  });
});
