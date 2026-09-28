// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests des helpers de persistance (plan 4.4, FR-13).
 * Execute avec `npm run test:conversation` : aucun reseau, aucun Supabase.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONVERSATION_MESSAGES,
  MAX_TITLE_LENGTH,
  deriveConversationTitle,
  parseStoredMeta,
  rowsToHistory,
  rowsToInitialMessages,
} from "../lib/chat/conversations.ts";

const CITE = {
  sourceId: "r1",
  title: "Politique de congés payés",
  category: "Procédure",
  chunkId: "c1",
  excerpt: "Solde au 31 décembre.",
  asLead: false,
};

describe("deriveConversationTitle (FR-13 titrage auto)", () => {
  it("question courte -> titre = question nettoye", () => {
    assert.equal(
      deriveConversationTitle("  Combien de jours de congés ?  "),
      "Combien de jours de congés ?",
    );
  });

  it("espaces multiples collapses", () => {
    assert.equal(
      deriveConversationTitle("titre\navec\t espaces"),
      "titre avec espaces",
    );
  });

  it("question longue -> tronque sur mot, suffixe ellipsis, <= 60+1", () => {
    const long = `${"conge payes question tres longue pour tester ".repeat(8)}fin`;
    const title = deriveConversationTitle(long);
    assert.ok(title.length <= MAX_TITLE_LENGTH + 1);
    assert.ok(title.endsWith("…"));
    assert.ok(!title.endsWith(" …") || title.length <= MAX_TITLE_LENGTH + 1);
    assert.ok(!title.includes("  "));
  });

  it("coupe sans espace utile -> troncature brute", () => {
    const title = deriveConversationTitle("x".repeat(120));
    assert.equal(title, `${"x".repeat(MAX_TITLE_LENGTH)}…`);
  });

  it("question vide -> repli par defaut", () => {
    assert.equal(
      deriveConversationTitle("   "),
      CONVERSATION_MESSAGES.defaultTitle,
    );
    assert.equal(
      deriveConversationTitle(null),
      CONVERSATION_MESSAGES.defaultTitle,
    );
  });
});

describe("parseStoredMeta (meta jsonb 4.4)", () => {
  it("meta valide : citations + abstained", () => {
    const meta = parseStoredMeta({ abstained: false, citations: [CITE], suggestions: [] });
    assert.equal(meta.citations.length, 1);
    assert.equal(meta.abstained, false);
  });

  it("meta '{}' ou absent -> null (degrade silencieux)", () => {
    assert.equal(parseStoredMeta({}), null);
    assert.equal(parseStoredMeta(null), null);
    assert.equal(parseStoredMeta("chaine"), null);
    assert.equal(parseStoredMeta(undefined), null);
  });

  it("citations invalides filtree, abstention conservee", () => {
    const meta = parseStoredMeta({
      abstained: true,
      citations: [CITE, { bogus: true }, null],
      suggestions: "pas-un-tableau",
    });
    assert.equal(meta.abstained, true);
    assert.equal(meta.citations.length, 1);
    assert.deepEqual(meta.suggestions, []);
  });
});

describe("rowsToHistory (contexte de suivi FR-13)", () => {
  it("lignes valides -> tours chronologiques bornes a 8", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `tour ${i}`,
      meta: {},
    }));
    const history = rowsToHistory(rows);
    assert.equal(history.length, 8);
    assert.equal(history[0].content, "tour 4");
    assert.equal(history[7].content, "tour 11");
  });

  it("roles invalides / contenus vides ignores", () => {
    const history = rowsToHistory([
      { role: "system", content: "injecte" },
      { role: "user", content: "   " },
      { role: "user" },
      null,
      { role: "user", content: "valide" },
    ]);
    assert.equal(history.length, 1);
    assert.equal(history[0].content, "valide");
  });

  it("non-tableau -> []", () => {
    assert.deepEqual(rowsToHistory("nope"), []);
    assert.deepEqual(rowsToHistory(undefined), []);
  });
});

describe("rowsToInitialMessages (relecture /chat/[id])", () => {
  it("assistant reprend meta (puces + abstention) ; user simple", () => {
    const messages = rowsToInitialMessages([
      { id: "m1", role: "user", content: "Question ?" },
      {
        id: "m2",
        role: "assistant",
        content: "Reponse [1].",
        meta: { abstained: false, citations: [CITE], suggestions: [] },
      },
    ]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "user");
    assert.equal(messages[0].stream, null);
    assert.equal(messages[1].stream.text, "Reponse [1].");
    assert.equal(messages[1].stream.done, true);
    assert.equal(messages[1].stream.meta.citations.length, 1);
    assert.equal(messages[1].stream.meta.citations[0].title, CITE.title);
  });

  it("assistant abstention : meta.abstained conserve pour l'encadre ambre", () => {
    const messages = rowsToInitialMessages([
      {
        id: "m1",
        role: "assistant",
        content: "Cette information n'a pas été trouvée…",
        meta: { abstained: true, citations: [], suggestions: [{ ...CITE, asLead: true }] },
      },
    ]);
    assert.equal(messages[0].stream.meta.abstained, true);
    assert.equal(messages[0].stream.meta.suggestions[0].asLead, true);
  });

  it("meta manquant ({}) -> puce absente sans crash", () => {
    const messages = rowsToInitialMessages([
      { id: "m1", role: "assistant", content: "Reponse sans meta." },
    ]);
    assert.equal(messages[0].stream.meta, null);
    assert.equal(messages[0].stream.text, "Reponse sans meta.");
  });

  it("lignes invalides ignorees, ordre preserve", () => {
    const messages = rowsToInitialMessages([
      { id: "m1", role: "ninja", content: "hack" },
      { id: "m2", role: "user", content: "ok" },
      null,
    ]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].text, "ok");
  });
});
