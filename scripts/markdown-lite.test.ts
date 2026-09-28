// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests du parseur « markdown-lite » (rendu des reponses de l'assistant).
 * Execute avec `npm run test:markdown` : aucun reseau, aucun React.
 *
 * Deux familles d'assertions :
 * 1. le texte n'est JAMAIS perdu ni affuble de marqueurs bruts (la demande
 *    initiale : les `**` qui restaient a l'ecran) ;
 * 2. les puces de citation `[n]` survivent au gras et restent bornees
 *    (FR-11 : pas de puce fantome).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseAnswerBlocks, stripMarkdownInline, tokenizeInline } from "../lib/text/markdown.ts";

/** Tout le texte rendu, puces reinclues : sert aux tests « aucun caractere perdu ». */
function renderTokens(tokens) {
  return tokens.map((t) => (t.citationIndex === null ? t.text : `[${t.text}]`)).join("");
}
function flatten(blocks) {
  return blocks.map((b) => b.items.map(renderTokens).join("\n")).join("\n");
}
const plainText = (tokens) =>
  tokens.filter((t) => t.citationIndex === null).map((t) => t.text).join("");

describe("tokenizeInline : emphase", () => {
  it("convertit **gras** sans laisser d'asterisque", () => {
    const tokens = tokenizeInline("Vous avez **25 jours** de conges.", 0);
    assert.equal(plainText(tokens), "Vous avez 25 jours de conges.");
    assert.equal(tokens.find((t) => t.text === "25 jours").strong, true);
    assert.equal(tokens.find((t) => t.text === "Vous avez ").strong, false);
  });

  it("__gras__ est reconnu, un identifiant avec _ simples ne l'est pas", () => {
    assert.equal(tokenizeInline("__important__", 0)[0].strong, true);
    const id = tokenizeInline("la RPC match_chunks et l'uuid 1f2e3d4c", 0);
    assert.equal(id.some((t) => t.emphasis || t.strong), false);
    assert.equal(plainText(id), "la RPC match_chunks et l'uuid 1f2e3d4c");
  });

  it("*italique* et `code` rendent du texte propre", () => {
    assert.equal(tokenizeInline("*attention*", 0)[0].emphasis, true);
    assert.equal(plainText(tokenizeInline("remboursement de `65 EUR` par heure")), "remboursement de 65 EUR par heure");
  });

  it("emphase JAMAIS FERMEE (flux en cours) : plus de marqueur, texte entier", () => {
    const tokens = tokenizeInline("**Les etapes de la procedure", 0);
    assert.equal(plainText(tokens), "Les etapes de la procedure");
    assert.ok(!tokens.some((t) => t.text.includes("*")));
  });

  it("gras imbrique un italique sans rien perdre", () => {
    assert.equal(plainText(tokenizeInline("**delai *cinq jours* valide**")), "delai cinq jours valide");
  });

  it("texte sans marqueur : un seul token, integrite parfaite", () => {
    const tokens = tokenizeInline("Aucune mise en forme ici.", 0);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].text, "Aucune mise en forme ici.");
  });

  it("vide et null ne levent pas", () => {
    assert.deepEqual(tokenizeInline("", 1), []);
    assert.deepEqual(tokenizeInline(null, 1), []);
  });
});

describe("tokenizeInline : puces de citation (FR-11)", () => {
  it("extrait [1] comme puce et conserve le texte alentour", () => {
    const tokens = tokenizeInline("Vous avez 25 jours [1]. Profitez-en.", 1);
    const chips = tokens.filter((t) => t.citationIndex !== null);
    assert.equal(chips.length, 1);
    assert.deepEqual({ text: chips[0].text, index: chips[0].citationIndex }, { text: "1", index: 0 });
    assert.equal(renderTokens(tokens), "Vous avez 25 jours [1]. Profitez-en.");
  });

  it("deux puces dans la meme phrase", () => {
    const indexes = tokenizeInline("Teletravail [1] et conges [2].", 2)
      .filter((t) => t.citationIndex !== null)
      .map((t) => t.citationIndex);
    assert.deepEqual(indexes, [0, 1]);
  });

  it("[9] hors borne et [x] restent du texte brut", () => {
    assert.equal(plainText(tokenizeInline("Voir [9] et [x].", 2)), "Voir [9] et [x].");
    assert.equal(tokenizeInline("Voir [9].", 2).some((t) => t.citationIndex !== null), false);
  });

  it("zero citation : aucune puce meme avec [1] dans le texte", () => {
    assert.equal(tokenizeInline("Reponse [1] sans sources.", 0).some((t) => t.citationIndex !== null), false);
  });

  it("une puce a l'interieur d'un gras reste cliquable", () => {
    const tokens = tokenizeInline("**Etape 1 :** remplir le formulaire [2].", 2);
    assert.equal(tokens.find((t) => t.citationIndex !== null).citationIndex, 1);
    assert.equal(tokens.find((t) => t.text === "Etape 1 :").strong, true);
  });
});

describe("parseAnswerBlocks : structure", () => {
  it("separe paragraphe, liste a puces et liste numerotee", () => {
    const blocks = parseAnswerBlocks(
      "**Reponse :** vous avez 25 jours.\n" +
        "- Conges annuels [1]\n" +
        "- Fractionnement [1]\n" +
        "\n" +
        "1. Faire la demande\n" +
        "2. Attendre la validation",
      1,
    );
    assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "bullets", "numbers"]);
    assert.equal(blocks[1].items.length, 2);
    assert.equal(blocks[2].items.length, 2);
    assert.equal(blocks[0].items[0][0].strong, true);
  });

  it("titre markdown rendu en bloc heading, sans croisillon", () => {
    const blocks = parseAnswerBlocks("## Procedure de remboursement");
    assert.deepEqual(blocks.map((b) => b.kind), ["heading"]);
    assert.equal(flatten(blocks), "Procedure de remboursement");
  });

  it("deux lignes consecutives = un seul paragraphe (saut souple)", () => {
    const blocks = parseAnswerBlocks("Le solde s'acquiert\nau 31 decembre.");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].items.length, 1);
    assert.equal(flatten(blocks), "Le solde s'acquiert au 31 decembre.");
  });

  it("liste a asteriques : plus aucun signe brut a l'ecran", () => {
    const blocks = parseAnswerBlocks("* **Delai** : 5 jours\n* *Delai de carence* : 3 jours");
    assert.deepEqual(blocks.map((b) => b.kind), ["bullets"]);
    assert.equal(flatten(blocks), "Delai : 5 jours\nDelai de carence : 3 jours");
  });

  it("separateur --- et bloc de code : pas de ligne fantome, texte garde", () => {
    const blocks = parseAnswerBlocks("Avant\n---\n```\nnote interne\n```\nApres");
    const rendered = flatten(blocks);
    assert.equal(rendered.includes("---"), false);
    assert.ok(rendered.includes("note interne"));
    assert.ok(rendered.startsWith("Avant"));
    assert.ok(rendered.endsWith("Apres"));
  });

  it("reponse en cours de frappe : chaque etape du flux reste rendable", () => {
    const partials = [
      "**",
      "**Le",
      "**Le delai** est",
      "**Le delai** est de 5 jours [1]\n1. Prem",
    ];
    for (const partial of partials) {
      const rendered = flatten(parseAnswerBlocks(partial, 1));
      assert.ok(!rendered.includes("**"), `marqueurs bruts sur « ${partial} »`);
      assert.ok(!/^[ \t]*[*-][ \t]/m.test(rendered), `puce brute sur « ${partial} »`);
    }
  });

  it("texte vide -> aucun bloc (rien a rendre)", () => {
    assert.deepEqual(parseAnswerBlocks("", 1), []);
    assert.deepEqual(parseAnswerBlocks("   \n  \n", 1), []);
    assert.deepEqual(parseAnswerBlocks(null, 1), []);
  });
});

describe("stripMarkdownInline : puces de synthese", () => {
  it("retire tiret, gras, code et titre en gardant le texte", () => {
    assert.equal(stripMarkdownInline("- **Lock-in** : migration impossible"), "Lock-in : migration impossible");
    assert.equal(stripMarkdownInline("**Delai : ** 5 jours"), "Delai : 5 jours");
    assert.equal(stripMarkdownInline("`65 EUR` par heure"), "65 EUR par heure");
    assert.equal(stripMarkdownInline("### Conclusion"), "Conclusion");
    assert.equal(stripMarkdownInline("1. Deposer la demande"), "Deposer la demande");
  });

  it("emphase jamais fermee : le texte survit, pas les asterisques", () => {
    assert.equal(stripMarkdownInline("**Important prevoir un badge"), "Important prevoir un badge");
  });

  it("vide et null -> chaine vide", () => {
    assert.equal(stripMarkdownInline(""), "");
    assert.equal(stripMarkdownInline(null), "");
    assert.equal(stripMarkdownInline("   "), "");
  });
});

