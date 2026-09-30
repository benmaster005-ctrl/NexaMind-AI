import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cleanDocumentText, unbreakSentences, removePageNumbers } from "../lib/document-parser/cleaner.ts";
import { parseStructuredDocument, decomposeTitle, extractMetadata } from "../lib/document-parser/parser.ts";

describe("pipeline de nettoyage et normalisation de documents extraits", () => {
  it("supprime les numéros de page et mentions de passages (Page 1 / 2, Passage 2 / 2, etc.)", () => {
    const raw = `
Introduction au service.
Page 1 / 2
Contenu de la première page.
Passage 1 / 2
Page 2 / 2
Passage 2 / 2
Conclusion du document.
    `;
    const cleaned = removePageNumbers(raw);
    assert.ok(!cleaned.includes("Page 1 / 2"), "Page 1 / 2 doit être supprimé");
    assert.ok(!cleaned.includes("Page 2 / 2"), "Page 2 / 2 doit être supprimé");
    assert.ok(!cleaned.includes("Passage 1 / 2"), "Passage 1 / 2 doit être supprimé");
    assert.ok(!cleaned.includes("Passage 2 / 2"), "Passage 2 / 2 doit être supprimé");
    assert.ok(cleaned.includes("Introduction au service."));
    assert.ok(cleaned.includes("Conclusion du document."));
  });

  it("reconstruit les phrases coupées entre plusieurs lignes", () => {
    const raw = "la création est gratuite et ne nécessite pas de carte\nbancaire.";
    const result = unbreakSentences(raw);
    assert.equal(result, "la création est gratuite et ne nécessite pas de carte bancaire.");
  });

  it("préserve les vrais paragraphes, listes et titres", () => {
    const raw = `
# Titre Principal

Premier paragraphe complet.

Deuxième paragraphe avec une liste :
- Premier point
- Deuxième point

## Section 2
Texte de la section.
    `;
    const cleaned = cleanDocumentText(raw);
    assert.ok(cleaned.includes("# Titre Principal"));
    assert.ok(cleaned.includes("- Premier point"));
    assert.ok(cleaned.includes("- Deuxième point"));
    assert.ok(cleaned.includes("## Section 2"));
  });
});

describe("détection de structure et modèle de document", () => {
  it("décompose le titre avec surtitre et sous-titre", () => {
    const decomp = decomposeTitle("FAQ Client — Questions fréquentes");
    assert.equal(decomp.surtitle, "FAQ Client");
    assert.equal(decomp.subtitle, "Questions fréquentes");
  });

  it("détecte les métadonnées verticales ou horizontales", () => {
    const lines = [
      "RÉFÉRENCE",
      "FAQ-CLI-001",
      "VERSION",
      "1.4",
      "MISE À JOUR",
      "02/04/2026",
      "PROPRIÉTAIRE",
      "Relation Client",
      "STATUT",
      "Public",
      "1. Compte et accès",
    ];
    const { metadata, remainingLines } = extractMetadata(lines);
    assert.equal(metadata.length, 5);
    assert.equal(metadata.find((m) => m.label === "RÉFÉRENCE")?.value, "FAQ-CLI-001");
    assert.equal(metadata.find((m) => m.label === "VERSION")?.value, "1.4");
    assert.equal(metadata.find((m) => m.label === "PROPRIÉTAIRE")?.value, "Relation Client");
    assert.equal(metadata.find((m) => m.label === "STATUT")?.value, "Public");
    assert.equal(remainingLines[0], "1. Compte et accès");
  });

  it("parse un document FAQ complet selon la spec exacte du document fourni", () => {
    const faqChunks = [
      {
        id: "chunk-1",
        index: 0,
        text: `
# FAQ Client — Questions fréquentes

RÉFÉRENCE
FAQ-CLI-001

VERSION
1.4

MISE À JOUR
02/04/2026

PROPRIÉTAIRE
Relation Client

STATUT
Public

1. Compte et accès

Q. Comment créer un compte NexaWorks ?

R. Rendez-vous sur nexaworks.io, cliquez sur « Créer un compte »,
renseignez votre e-mail professionnel et validez le lien reçu
par e-mail.

Q. J'ai oublié mon mot de passe, que faire ?

R. Cliquez sur « Mot de passe oublié » sur la page de connexion.
Un lien de réinitialisation valable 30 minutes vous sera envoyé
à l'adresse associée à votre compte.

Page 1 / 2
Passage 1 / 2
        `,
      },
      {
        id: "chunk-2",
        index: 1,
        text: `
# FAQ Client — Questions fréquentes

2. Offres et facturation

Q. Quelles sont les formules disponibles ?

R. Trois formules : Starter, Business et Enterprise. Consultez la page tarifs
pour plus de détails.

Page 2 / 2
Passage 2 / 2
        `,
      },
    ];

    const doc = parseStructuredDocument({
      documentTitle: "FAQ Client — Questions fréquentes",
      category: "Support",
      chunks: faqChunks,
      targetChunkId: "chunk-2",
    });

    assert.equal(doc.surtitle, "FAQ Client");
    assert.equal(doc.subtitle, "Questions fréquentes");
    assert.equal(doc.metadata.length, 5);
    assert.equal(doc.isFaq, true);

    // Vérification de la table des matières
    assert.ok(doc.tableOfContents.length >= 2, "La TOC doit contenir au moins 2 sections");
    assert.ok(doc.tableOfContents.some((t) => t.title.includes("Compte et accès")));
    assert.ok(doc.tableOfContents.some((t) => t.title.includes("Offres et facturation")));

    // Vérification des Q&A
    const sec1 = doc.sections.find((s) => s.title.includes("Compte et accès"));
    assert.ok(sec1, "Section 1 trouvée");
    const qa1 = sec1.blocks.find((b) => b.type === "qa");
    assert.ok(qa1, "Q&A trouvé dans la section 1");
    if (qa1 && qa1.type === "qa") {
      assert.ok(qa1.question.includes("Comment créer un compte NexaWorks ?"));
      assert.ok(qa1.answer.includes("nexaworks.io"));
      // Vérification que les lignes coupées ont été réunies
      assert.ok(qa1.answer.includes("renseignez votre e-mail"));
    }

    // Vérification du chunk actif / ciblé
    const sec2 = doc.sections.find((s) => s.title.includes("Offres et facturation"));
    assert.ok(sec2, "Section 2 trouvée");
    const qaTarget = sec2.blocks.find((b) => b.type === "qa");
    assert.equal(qaTarget?.isActive, true, "Le block du chunk 2 doit être marqué isActive");
  });

  it("parse un tableau Markdown correctement", () => {
    const tableChunks = [
      {
        id: "chunk-table",
        index: 0,
        text: `
| Formule | Prix | Utilisateurs |
|---|---|---|
| Starter | 29€ / mois | Jusqu'à 5 |
| Enterprise | Sur devis | Illimité |
        `,
      },
    ];

    const doc = parseStructuredDocument({
      documentTitle: "Grille tarifaire",
      chunks: tableChunks,
    });

    const tableBlock = doc.sections[0]?.blocks.find((b) => b.type === "table");
    assert.ok(tableBlock, "Bloc tableau détecté");
    if (tableBlock && tableBlock.type === "table") {
      assert.deepEqual(tableBlock.headers, ["Formule", "Prix", "Utilisateurs"]);
      assert.equal(tableBlock.rows.length, 2);
      assert.equal(tableBlock.rows[0][0], "Starter");
    }
  });

  it("parse des listes à puces et listes ordonnées", () => {
    const listChunks = [
      {
        id: "chunk-list",
        index: 0,
        text: `
Points importants :
- Sécurité renforcée
- Chiffrement AES-256
- Sauvegarde quotidienne
        `,
      },
    ];

    const doc = parseStructuredDocument({
      documentTitle: "Sécurité",
      chunks: listChunks,
    });

    const listBlock = doc.sections[0]?.blocks.find((b) => b.type === "list");
    assert.ok(listBlock, "Bloc liste détecté");
    if (listBlock && listBlock.type === "list") {
      assert.equal(listBlock.items.length, 3);
      assert.equal(listBlock.ordered, false);
      assert.equal(listBlock.items[0], "Sécurité renforcée");
    }
  });
});
