// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests du service RAG (plan 4.1, FR-10/FR-12, AD-1).
 * Execute avec `npm run test:rag` : aucun reseau, doubles injectes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ABSTENTION_MESSAGE,
  MAX_CITATIONS,
  RAG_THRESHOLD,
  answerQuestion,
  buildSystemPrompt,
  clampHistory,
  prepareRagContext,
  selectGrounded,
} from "../lib/ai/rag.ts";

function groundHit(overrides = {}) {
  return {
    resourceId: "r1",
    chunkId: "c1",
    title: "Politique de congés payés",
    category: "Procédure",
    createdAt: "2026-01-01T00:00:00Z",
    excerpt: "Le solde de congés se calcule au 31 décembre.",
    similarity: 0.82,
    matchKind: "semantic",
    ...overrides,
  };
}

describe("selectGrounded / prepareRagContext (plan 4.1)", () => {
  it("aucun resultat -> abstention sans piste", () => {
    const ctx = prepareRagContext([]);
    assert.equal(ctx.ok, true);
    assert.equal(ctx.abstained, true);
    assert.deepEqual(ctx.grounded, []);
    assert.deepEqual(ctx.leads, []);
  });

  it("semantique sous le seuil 0.65 -> abstention avec pistes", () => {
    const low = groundHit({ resourceId: "r9", similarity: 0.4 });
    const ctx = prepareRagContext([low]);
    assert.equal(ctx.abstained, true);
    assert.equal(ctx.leads.length, 1);
    assert.equal(ctx.leads[0].resourceId, "r9");
  });

  it("hit texte seul (similarity null) -> abstention (grounding indemontrable)", () => {
    const textHit = groundHit({ matchKind: "text", similarity: null });
    const ctx = prepareRagContext([textHit]);
    assert.equal(ctx.abstained, true);
  });

  it("mixture : garde uniquement les hits >= 0.65 distincts par ressource", () => {
    const ok1 = groundHit();
    const ok1Dup = groundHit({ chunkId: "c2", excerpt: "autre passage" });
    const ok2 = groundHit({ resourceId: "r2", chunkId: "c3", similarity: 0.71 });
    const low = groundHit({ resourceId: "r3", similarity: RAG_THRESHOLD - 0.01 });
    const { grounded, leads } = selectGrounded([ok1, ok1Dup, ok2, low]);
    assert.equal(grounded.length, 2);
    assert.deepEqual(
      grounded.map((r) => r.resourceId),
      ["r1", "r2"],
    );
    assert.deepEqual(
      leads.map((r) => r.resourceId),
      ["r3"],
    );
  });

  it("plafond MAX_CITATIONS ressources distinctes", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      groundHit({ resourceId: `r${i}`, chunkId: `c${i}` }),
    );
    const { grounded } = selectGrounded(many);
    assert.equal(grounded.length, MAX_CITATIONS);
  });
});

describe("buildSystemPrompt (AD-1)", () => {
  it("contient les sources numerotees et les regles anti-hallucination", () => {
    const prompt = buildSystemPrompt([
      groundHit(),
      groundHit({ resourceId: "r2", title: "Frais de déplacement" }),
    ]);
    assert.match(prompt, /\[1\] Politique de congés payés — Procédure/);
    assert.match(prompt, /\[2\] Frais de déplacement/);
    assert.match(prompt, /EXCLUSIVEMENT/);
    assert.ok(prompt.includes(ABSTENTION_MESSAGE));
    assert.match(prompt, /\[n\]/);
  });
});

describe("clampHistory (FR-13)", () => {
  it("borne a 8 tours et ignore les entrees invalides", () => {
    const raw = [
      ...Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `tour ${i}`,
      })),
      { role: "system", content: "injecte" },
      { role: "user", content: "   " },
      null,
    ];
    const history = clampHistory(raw);
    assert.equal(history.length, 8);
    assert.equal(history[history.length - 1].content, "tour 11");
    assert.ok(history.every((t) => t.role === "user" || t.role === "assistant"));
  });

  it("non-tableau -> []", () => {
    assert.deepEqual(clampHistory("nope"), []);
    assert.deepEqual(clampHistory(undefined), []);
  });
});

describe("answerQuestion : validations et abstention (FR-12)", () => {
  it("question vide -> ok:false, 0 appel externe", async () => {
    let calls = 0;
    const out = await answerQuestion({
      question: "   ",
      deps: {
        retrieve: async () => { calls += 1; return []; },
        generate: async () => { calls += 1; return "jamais"; },
      },
    });
    assert.equal(out.ok, false);
    assert.equal(out.message, "Posez une question pour interroger l'assistant.");
    assert.equal(calls, 0);
  });

  it("question trop longue (>2000) -> ok:false, 0 appel externe", async () => {
    let calls = 0;
    const out = await answerQuestion({
      question: "x".repeat(2001),
      deps: {
        retrieve: async () => { calls += 1; return []; },
        generate: async () => { calls += 1; return "jamais"; },
      },
    });
    assert.equal(out.ok, false);
    assert.equal(calls, 0);
  });

  it("aucun chunk ground -> abstention standard, generation NON appelee", async () => {
    let generated = 0;
    const out = await answerQuestion({
      question: "Quel est le budget du projet X ?",
      deps: {
        retrieve: async () => [],
        generate: async () => { generated += 1; return "reponse"; },
      },
    });
    assert.equal(out.ok, true);
    assert.equal(out.abstained, true);
    assert.equal(out.answer, ABSTENTION_MESSAGE);
    assert.equal(generated, 0);
    assert.equal(out.citations.length, 0);
  });

  it("abstention : les documents proches sont marques asLead (pistes)", async () => {
    const lead = groundHit({ resourceId: "r5", similarity: 0.4 });
    const out = await answerQuestion({
      question: "sujet hors documents",
      deps: { retrieve: async () => [lead], generate: async () => "x" },
    });
    assert.equal(out.abstained, true);
    assert.equal(out.suggestions.length, 1);
    assert.equal(out.suggestions[0].asLead, true);
    assert.equal(out.citations.length, 0);
  });
});

describe("answerQuestion : nominal et erreurs", () => {
  it("reponse nominale : generation avec system + historique + question", async () => {
    const seen = {};
    const out = await answerQuestion({
      question: "Combien de jours de congés ?",
      history: [
        { role: "user", content: "question precedente" },
        { role: "assistant", content: "reponse precedente" },
      ],
      deps: {
        retrieve: async () => [groundHit()],
        generate: async (input) => {
          seen.system = input.system;
          seen.messages = input.messages;
          return "Vous disposez de 25 jours [1].";
        },
      },
    });
    assert.equal(out.ok, true);
    assert.equal(out.abstained, false);
    assert.equal(out.answer, "Vous disposez de 25 jours [1].");
    assert.equal(out.citations.length, 1);
    assert.equal(out.citations[0].asLead, false);
    assert.equal(out.citations[0].sourceId, "r1");
    assert.ok(seen.system.includes("Politique de congés payés"));
    assert.equal(seen.messages.length, 3);
    assert.deepEqual(seen.messages[0], {
      role: "user",
      content: "question precedente",
    });
    assert.deepEqual(seen.messages[2], {
      role: "user",
      content: "Combien de jours de congés ?",
    });
  });

  it("echec retrieval -> ok:false, message FR, pas d'exception", async () => {
    const out = await answerQuestion({
      question: "question valide",
      deps: {
        retrieve: async () => { throw new Error("reseau"); },
        generate: async () => "x",
      },
    });
    assert.equal(out.ok, false);
    assert.match(out.message, /temporairement indisponible/);
  });

  it("echec generation -> ok:false, message FR, pas de reponse partielle", async () => {
    const out = await answerQuestion({
      question: "question valide",
      deps: {
        retrieve: async () => [groundHit()],
        generate: async () => { throw new Error("timeout"); },
      },
    });
    assert.equal(out.ok, false);
    assert.equal(out.answer, "");
    assert.match(out.message, /échoué/);
  });

  it("generation vide -> ok:false", async () => {
    const out = await answerQuestion({
      question: "question valide",
      deps: {
        retrieve: async () => [groundHit()],
        generate: async () => "   ",
      },
    });
    assert.equal(out.ok, false);
  });
});
