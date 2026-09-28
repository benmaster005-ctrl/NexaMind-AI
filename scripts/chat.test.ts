// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests des helpers de streaming /api/chat (plan 4.2, FR-10/FR-11).
 * Execute avec `npm run test:chat` : aucun reseau, generateur factice.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createChatEventStream,
  encodeChatEvent,
  metaEvent,
  parseChatRequest,
} from "../lib/ai/chat.ts";
import { ABSTENTION_MESSAGE, RAG_MESSAGES, prepareChatTurn } from "../lib/ai/rag.ts";

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

function collect(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  return (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    return out;
  })();
}

function parseLines(ndjson) {
  return ndjson
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

describe("parseChatRequest (4.2)", () => {
  it("corps valide : question trim + history bornee", () => {
    const parsed = parseChatRequest({
      question: "  Combien de jours ?  ",
      history: [
        { role: "user", content: "avant" },
        { role: "system", content: "injecte" },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.question, "Combien de jours ?");
    assert.equal(parsed.history.length, 1);
  });

  it("corps absent / non-objet -> invalide", () => {
    assert.equal(parseChatRequest(null).ok, false);
    assert.equal(parseChatRequest("str").ok, false);
    assert.equal(parseChatRequest({}).ok, false);
  });

  it("question vide ou trop longue -> invalide avec message FR", () => {
    assert.equal(parseChatRequest({ question: "   " }).ok, false);
    const tooLong = parseChatRequest({ question: "x".repeat(2001) });
    assert.equal(tooLong.ok, false);
    assert.match(tooLong.message, /2000/);
  });
});

describe("encodeChatEvent / metaEvent", () => {
  it("une ligne JSON par evenement, finie par \\n", () => {
    const line = encodeChatEvent({ type: "text", text: "bonjour" });
    assert.ok(line.endsWith("\n"));
    assert.equal(line.split("\n").length, 2);
    assert.deepEqual(JSON.parse(line), { type: "text", text: "bonjour" });
  });

  it("metaEvent transporte citations et suggestions", () => {
    const ev = metaEvent({
      abstained: true,
      citations: [],
      suggestions: [
        {
          sourceId: "r1",
          title: "Doc",
          category: "FAQ",
          chunkId: "c1",
          excerpt: "extrait",
          asLead: true,
        },
      ],
    });
    assert.equal(ev.type, "meta");
    assert.equal(ev.abstained, true);
    assert.equal(ev.suggestions.length, 1);
    assert.equal(ev.suggestions[0].asLead, true);
  });

describe("createChatEventStream : ordre meta -> text -> done", () => {
  const META = {
    abstained: false,
    citations: [
      {
        sourceId: "r1",
        title: "Politique de congés payés",
        category: "Procédure",
        chunkId: "c1",
        excerpt: "Solde au 31 décembre.",
        asLead: false,
      },
    ],
    suggestions: [],
  };

  it("flux nominal : meta en tete, puis les chunks, puis done", async () => {
    async function* chunks() {
      yield "Bonjour, ";
      yield "voici la réponse [1].";
    }
    const ndjson = await collect(
      createChatEventStream({ meta: META, textSource: chunks() }),
    );
    const events = parseLines(ndjson);
    assert.equal(events[0].type, "meta");
    assert.equal(events[0].citations.length, 1);
    assert.equal(events[0].citations[0].sourceId, "r1");
    assert.equal(events[1].type, "text");
    assert.equal(events[2].type, "text");
    assert.equal(events[3].type, "done");
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => e.text)
      .join("");
    assert.equal(text, "Bonjour, voici la réponse [1].");
  });

  it("abstention : meta.abstained + formule standard en un seul text", async () => {
    const ndjson = await collect(
      createChatEventStream({
        meta: { abstained: true, citations: [], suggestions: [] },
        staticText: ABSTENTION_MESSAGE,
        textSource: [],
      }),
    );
    const events = parseLines(ndjson);
    assert.equal(events[0].abstained, true);
    assert.deepEqual(events[0].citations, []);
    assert.equal(events[1].type, "text");
    assert.equal(events[1].text, ABSTENTION_MESSAGE);
    assert.equal(events[2].type, "done");
    assert.equal(events.length, 3);
  });

  it("source qui leve -> evenement error puis done (pas d'exception)", async () => {
    async function* broken() {
      yield "partiel";
      throw new Error("flux coupe");
    }
    const ndjson = await collect(
      createChatEventStream({ meta: META, textSource: broken() }),
    );
    const events = parseLines(ndjson);
    const last = events[events.length - 1];
    assert.equal(last.type, "done");
    const err = events.find((e) => e.type === "error");
    assert.ok(err);
    assert.equal(err.message, "flux coupe");
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => e.text)
      .join("");
    assert.equal(text, "partiel");
  });

  it("cancel() du lecteur ne leve pas d'exception", async () => {
    const stream = createChatEventStream({
      meta: META,
      staticText: "trop tard",
    });
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    assert.ok(true);
  });

  it("reponse vide du modele -> emptyFallback emis (jamais de bulle blanche)", async () => {
    async function* vide() {
      // flux valide mais sans aucun caractere (modele qui ne repond pas)
    }
    const onFinishTexts: string[] = [];
    const ndjson = await collect(
      createChatEventStream({
        meta: META,
        textSource: vide(),
        emptyFallback: RAG_MESSAGES.generationEmpty,
        onFinish: (text) => {
          onFinishTexts.push(text);
        },
      }),
    );
    const events = parseLines(ndjson);
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => e.text)
      .join("");
    assert.equal(text, RAG_MESSAGES.generationEmpty);
    // La persistance (4.4) doit stocker le texte de repli, pas une ligne vide.
    assert.deepEqual(onFinishTexts, [RAG_MESSAGES.generationEmpty]);
    assert.equal(events[events.length - 1].type, "done");
  });

  it("done transporte le finishReason quand beforeDone le fournit", async () => {
    async function* chunks() {
      yield "réponse";
    }
    const ndjson = await collect(
      createChatEventStream({
        meta: META,
        textSource: chunks(),
        beforeDone: () => ({ finishReason: "stop" }),
      }),
    );
    const done = parseLines(ndjson).at(-1);
    assert.equal(done.type, "done");
    assert.equal(done.finishReason, "stop");
  });
});

describe("prepareChatTurn : plan partage route/tests (4.2)", () => {
  it("question invalide -> kind error, 0 retrieval", async () => {
    let calls = 0;
    const plan = await prepareChatTurn({
      question: "  ",
      retrieve: async () => { calls += 1; return []; },
    });
    assert.equal(plan.kind, "error");
    assert.equal(calls, 0);
  });

  it("retrieval KO -> kind error avec message FR", async () => {
    const plan = await prepareChatTurn({
      question: "question valide",
      retrieve: async () => { throw new Error("ko"); },
    });
    assert.equal(plan.kind, "error");
    assert.match(plan.message, /indisponible/);
  });

  it("abstention -> kind abstained, meta suggestions asLead, pas de generation", async () => {
    const plan = await prepareChatTurn({
      question: "sujet inconnu",
      retrieve: async () => [
        { ...groundHit(), similarity: 0.3, resourceId: "r7" },
      ],
    });
    assert.equal(plan.kind, "abstained");
    assert.equal(plan.answer, ABSTENTION_MESSAGE);
    assert.equal(plan.meta.citations.length, 0);
    assert.equal(plan.meta.suggestions[0].asLead, true);
    assert.equal("system" in plan, false);
  });

  it("grounded -> kind grounded, system numerote + messages avec historique", async () => {
    const plan = await prepareChatTurn({
      question: "Combien de jours ?",
      history: [{ role: "user", content: "question avant" }],
      retrieve: async () => [groundHit()],
    });
    assert.equal(plan.kind, "grounded");
    assert.equal(plan.meta.abstained, false);
    assert.equal(plan.meta.citations.length, 1);
    assert.ok(plan.system.includes("[1] Politique de congés payés"));
    assert.deepEqual(plan.messages, [
      { role: "user", content: "question avant" },
      { role: "user", content: "Combien de jours ?" },
    ]);
  });
});

});
