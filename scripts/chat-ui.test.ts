// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests des helpers d'interface de chat (plan 4.3, FR-10/FR-11/FR-12).
 * Execute avec `npm run test:chat-ui` : aucun reseau, aucun React.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHAT_UI_MESSAGES,
  citationAriaLabel,
  initialChatStreamState,
  reduceChatEvents,
  segmentAssistantText,
  suggestionLeads,
} from "../lib/chat/ui.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chatClientSrc = readFileSync(
  join(root, "components/chat/chat-client.tsx"),
  "utf8",
);

describe("chat-client : URL memorisable sans setState pendant le rendu", () => {
  it("conserve le replaceState vers /chat/<id> (4.4)", () => {
    assert.match(chatClientSrc, /history\.replaceState\(null, "", `\/chat\/\$\{cid\}`\)/);
  });

  it("n'appelle jamais replaceState dans un updater de state", () => {
    // React peut executer l'updater d'un setState pendant le rendu ; l'App
    // Router Next intercepte replaceState -> « Cannot update a component
    // (Router) while rendering a different component (ChatClient) ».
    assert.doesNotMatch(
      chatClientSrc,
      /set[A-Z]\w*\(\s*\(?\w*\)?\s*=>\s*\{[^}]*replaceState/,
    );
    // La conversation vit dans un ref : plus aucun state dedie.
    assert.doesNotMatch(chatClientSrc, /setActiveConversationId/);
    assert.match(chatClientSrc, /conversationRef\.current = cid;/);
    assert.match(chatClientSrc, /conversationId: conversationRef\.current/);
  });
});

const CITE = {
  sourceId: "r1",
  title: "Politique de congés payés",
  category: "Procédure",
  chunkId: "c1",
  excerpt: "Le solde se calcule au 31 décembre.",
  asLead: false,
};

describe("segmentAssistantText (FR-11)", () => {
  it("decoupe texte + puce [1] + texte", () => {
    const segments = segmentAssistantText(
      "Vous avez 25 jours [1]. Profitez-en.",
      1,
    );
    assert.equal(segments.length, 3);
    assert.deepEqual(segments[0], { text: "Vous avez 25 jours ", citationIndex: null });
    assert.deepEqual(segments[1], { text: "1", citationIndex: 0 });
    assert.deepEqual(segments[2], { text: ". Profitez-en.", citationIndex: null });
  });

  it("deux puces [1] [2] dans une meme phrase", () => {
    const segments = segmentAssistantText("Teletravail [1] et conges [2].", 2);
    const chips = segments.filter((s) => s.citationIndex !== null);
    assert.equal(chips.length, 2);
    assert.deepEqual(chips.map((c) => c.citationIndex), [0, 1]);
  });

  it("marqueur hors borne ([9] avec 2 citations) reste du texte", () => {
    const segments = segmentAssistantText("Voir [9].", 2);
    assert.ok(segments.every((s) => s.citationIndex === null));
    assert.equal(segments.map((s) => s.text).join(""), "Voir [9].");
  });

  it("zero citation : toutes les puces restent du texte", () => {
    const segments = segmentAssistantText("Reponse [1] sans sources.", 0);
    assert.ok(segments.every((s) => s.citationIndex === null));
  });

  it("texte sans crochet : un seul segment", () => {
    const segments = segmentAssistantText("Aucune citation ici.", 3);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].citationIndex, null);
  });

  it("crochet non suivi de chiffres : pas de crash", () => {
    const segments = segmentAssistantText("Liste [x] simple", 1);
    assert.ok(segments.every((s) => s.citationIndex === null));
    assert.equal(segments.map((s) => s.text).join(""), "Liste [x] simple");
  });

  it("texte vide -> []", () => {
    assert.deepEqual(segmentAssistantText("", 3), []);
    assert.deepEqual(segmentAssistantText(null, 3), []);
  });
});

describe("reduceChatEvents (flux NDJSON)", () => {
  it("meta puis text puis done", () => {
    let state = initialChatStreamState();
    state = reduceChatEvents(state, {
      type: "meta",
      abstained: false,
      citations: [CITE],
      suggestions: [],
    });
    assert.equal(state.meta.abstained, false);
    assert.equal(state.meta.citations.length, 1);
    state = reduceChatEvents(state, { type: "text", text: "Bonjour " });
    state = reduceChatEvents(state, { type: "text", text: "[1]." });
    state = reduceChatEvents(state, { type: "done" });
    assert.equal(state.text, "Bonjour [1].");
    assert.equal(state.done, true);
    assert.equal(state.error, "");
  });

  it("abstention : meta.abstained + suggestions asLead filtrables", () => {
    let state = initialChatStreamState();
    state = reduceChatEvents(state, {
      type: "meta",
      abstained: true,
      citations: [],
      suggestions: [
        { ...CITE, sourceId: "r2", title: "Guide", asLead: true },
        { ...CITE, sourceId: "r3", title: "FAQ", asLead: false },
      ],
    });
    const leads = suggestionLeads(state.meta);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].title, "Guide");
  });

  it("non-abstention : aucune piste affichee", () => {
    let state = initialChatStreamState();
    state = reduceChatEvents(state, {
      type: "meta",
      abstained: false,
      citations: [CITE],
      suggestions: [{ ...CITE, asLead: true }],
    });
    assert.deepEqual(suggestionLeads(state.meta), []);
  });

  it("evenement error -> message FR + done", () => {
    let state = initialChatStreamState();
    state = reduceChatEvents(state, { type: "error", message: "" });
    assert.equal(state.done, true);
    assert.equal(state.error, CHAT_UI_MESSAGES.networkError);
  });

  it("evenements inconnus ou malformes ignores", () => {
    const base = initialChatStreamState();
    assert.equal(reduceChatEvents(base, null), base);
    assert.equal(reduceChatEvents(base, { foo: 1 }), base);
    assert.equal(reduceChatEvents(base, { type: "other" }), base);
    const withText = reduceChatEvents(base, { type: "text", text: "" });
    assert.equal(withText.text, "");
  });
});

describe("citationAriaLabel (EXPERIENCE §4)", () => {
  it("avec titre : « Source 1 : Titre »", () => {
    assert.equal(
      citationAriaLabel(0, CITE),
      "Source 1 : Politique de congés payés",
    );
  });

  it("sans titre : numero seul", () => {
    assert.equal(citationAriaLabel(2), "Source 3");
  });
});
