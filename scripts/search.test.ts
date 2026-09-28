// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests du service de recherche hybride (plan 3.2, FR-8/FR-9).
 * Execute avec `npm run test:search` : aucun reseau, doubles injectes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SEARCH_MESSAGES,
  clampLimit,
  clampThreshold,
  searchDocuments,
} from "../lib/ai/search.ts";

function fakeVector() {
  return Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
}

const SEM_HIT = {
  chunk_id: "c1",
  resource_id: "r1",
  title: "Politique de travail à distance",
  category: "Procédure",
  created_at: "2026-01-01T00:00:00Z",
  content: "Le télétravail est autorisé deux jours par semaine.",
  similarity: 0.91,
};

const TEXT_HIT = {
  resource_id: "r2",
  title: "Guide du télétravail",
  category: "FAQ",
  created_at: "2026-02-01T00:00:00Z",
  excerpt: "Guide du télétravail",
};

describe("searchDocuments (plan 3.2)", () => {
  it("requete vide -> aucun appel externe", async () => {
    let calls = 0;
    const deps = {
      embedQuery: async () => { calls += 1; return fakeVector(); },
      runSemantic: async () => { calls += 1; return []; },
      runText: async () => { calls += 1; return []; },
    };
    const out = await searchDocuments({ query: "   ", deps });
    assert.equal(out.ok, true);
    assert.deepEqual(out.results, []);
    assert.equal(calls, 0);
  });

  it("semantique : retrouve sans mot-cle identique", async () => {
    const seen = {};
    const deps = {
      embedQuery: async (q) => { seen.q = q; return fakeVector(); },
      runSemantic: async (input) => {
        seen.input = input;
        return [SEM_HIT];
      },
      runText: async () => [],
    };
    const out = await searchDocuments({ query: "télétravail", deps });
    assert.equal(out.ok, true);
    assert.equal(out.results.length, 1);
    assert.equal(out.results[0].resourceId, "r1");
    assert.equal(out.results[0].matchKind, "semantic");
    assert.equal(out.results[0].excerpt, SEM_HIT.content);
    assert.equal(out.results[0].similarity, 0.91);
    assert.equal(seen.input.threshold, 0.65);
  });

  it("hybride : semantique puis texte, dedupe et plafond", async () => {
    const dupText = { ...TEXT_HIT, resource_id: "r1", excerpt: "doublon" };
    const deps = {
      embedQuery: async () => fakeVector(),
      runSemantic: async () => [SEM_HIT],
      runText: async () => [dupText, TEXT_HIT],
    };
    const out = await searchDocuments({ query: "travail", limit: 2, deps });
    assert.equal(out.results.length, 2);
    assert.equal(out.results[0].matchKind, "semantic");
    assert.equal(out.results[1].resourceId, "r2");
    assert.equal(out.results[1].matchKind, "text");
    assert.equal(out.results[1].similarity, null);
  });

  it("repli texte seul quand l'embedding echoue", async () => {
    const deps = {
      embedQuery: async () => { throw new Error("gemini down"); },
      runSemantic: async () => [SEM_HIT],
      runText: async () => [TEXT_HIT],
    };
    const out = await searchDocuments({ query: "guide", deps });
    assert.equal(out.ok, true);
    assert.equal(out.degraded, true);
    assert.equal(out.message, SEARCH_MESSAGES.embeddingFallback);
    assert.equal(out.results[0].matchKind, "text");
  });

  it("double echec -> ok:false avec message FR", async () => {
    const deps = {
      embedQuery: async () => { throw new Error("x"); },
      runSemantic: async () => { throw new Error("y"); },
      runText: async () => { throw new Error("z"); },
    };
    const out = await searchDocuments({ query: "abc", deps });
    assert.equal(out.ok, false);
    assert.deepEqual(out.results, []);
    assert.equal(out.message, SEARCH_MESSAGES.globalFailure);
  });

  it("filtre categorie + bornes", async () => {
    const other = { ...SEM_HIT, resource_id: "r9", category: "FAQ" };
    const deps = {
      embedQuery: async () => fakeVector(),
      runSemantic: async () => [SEM_HIT, other],
      runText: async () => [],
    };
    const out = await searchDocuments({
      query: "travail",
      category: "Procédure",
      limit: 99,
      deps,
    });
    assert.equal(out.results.length, 1);
    assert.equal(out.results[0].category, "Procédure");
    assert.equal(clampLimit(99), 50);
    assert.equal(clampLimit(0), 1);
    assert.equal(clampThreshold(2), 1);
    assert.equal(clampThreshold(-1), 0);
    // Parametre absent : la valeur par defaut doit s'appliquer. Regression
    // detectee par la validation MVP (2026-09-27) : `Number(null)` vaut 0,
    // donc le seuil tombait a 0 (bruit a 0.5 renvoye) et la limite a 1.
    assert.equal(clampThreshold(null), 0.65);
    assert.equal(clampThreshold(undefined), 0.65);
    assert.equal(clampThreshold(""), 0.65);
    assert.equal(clampThreshold("abc"), 0.65);
    assert.equal(clampLimit(null), 10);
    assert.equal(clampLimit(undefined), 10);
    assert.equal(clampLimit(""), 10);
    assert.equal(clampLimit("abc"), 10);
    // Une valeur explicite reste respectee.
    assert.equal(clampThreshold("0.8"), 0.8);
    assert.equal(clampLimit("5"), 5);
  });
});
