// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests de la synthese automatique (story 5.1, FR-14).
 * Execute avec `npm run test:summary` : aucun reseau, generation factice.
 * Une assertion par ligne de la matrice I/O du plan.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_BULLETS,
  MAX_SOURCE_CHARS,
  MIN_SOURCE_CHARS,
  READY_STATUS,
  SUMMARY_MESSAGES,
  SUMMARY_MODEL,
  buildSourceText,
  buildSummaryPrompt,
  parseBullets,
  summarizeResource,
} from "../lib/ai/summary.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const LONG_TEXT =
  "Procedure de suivi des projets clients. Cette procedure decrit comment " +
  "NexaWorks suit un projet client, du lancement a la cloture, afin de garantir " +
  "des delais tenus et une communication claire. ".repeat(8);

function readySource(overrides = {}) {
  return {
    title: "Procedure de suivi des projets clients",
    category: "Procedure",
    status: READY_STATUS,
    chunks: [LONG_TEXT],
    ...overrides,
  };
}

/** Generation factice : trace les appels et renvoie un texte brute. */
function fakeGenerate(text = "", { throws = false } = {}) {
  const calls = [];
  const generate = async (input) => {
    calls.push(input);
    if (throws) throw new Error("gemini indisponible");
    return text;
  };
  return { generate, calls };
}

describe("modele et bornes (contraintes AD-1/AD-4)", () => {
  it("utilise un modele non pensant valide en live", () => {
    // Les modeles « pensants » renvoient 0 caractere avec le SDK epingle.
    assert.equal(SUMMARY_MODEL, "gemini-3.1-flash-lite");
  });

  it("borne les puces a 8 et fixe le plancher de source", () => {
    assert.equal(MAX_BULLETS, 8);
    assert.equal(MIN_SOURCE_CHARS, 400);
  });
});

describe("buildSourceText", () => {
  it("joint les morceaux et signale la troncature au-dela du plafond", () => {
    const short = buildSourceText(["un", "deux"]);
    assert.equal(short.text, "un\n\ndeux");
    assert.equal(short.partial, false);

    const long = buildSourceText(["x".repeat(MAX_SOURCE_CHARS + 500)]);
    assert.equal(long.text.length, MAX_SOURCE_CHARS);
    assert.equal(long.partial, true);
  });
});

describe("buildSummaryPrompt", () => {
  it("inclut titre, categorie et contenu", () => {
    const prompt = buildSummaryPrompt(readySource({ chunks: ["CONTENU BRUT"] }));
    assert.match(prompt, /Procedure de suivi des projets clients/);
    assert.match(prompt, /Categorie|Catégorie/);
    assert.match(prompt, /CONTENU BRUT/);
  });
});

describe("parseBullets", () => {
  it("accepte -, bullet, tiret cadratin et listes numerotees", () => {
    const bullets = parseBullets(
      ["- un", "• deux", "– trois", "4. quatre", "* cinq"].join("\n"),
    );
    assert.deepEqual(bullets, ["un", "deux", "trois", "quatre", "cinq"]);
  });

  it("ignore preambule et lignes sans puce", () => {

describe("summarizeResource — matrice I/O", () => {
  it("HAPPY_PATH : 5 a 8 puces, message vide, generation appelee une fois", async () => {
    const raw = Array.from({ length: 6 }, (_, i) => `- point cle ${i + 1}`).join("\n");
    const { generate, calls } = fakeGenerate(raw);
    const outcome = await summarizeResource({ source: readySource(), deps: { generate } });

    assert.equal(outcome.ok, true);
    assert.equal(outcome.bullets.length, 6);
    assert.equal(outcome.partial, false);
    assert.equal(outcome.message, "");
    assert.equal(calls.length, 1);
    assert.match(calls[0].system, /Ne reformule AUCUN/);
    assert.match(calls[0].prompt, /Procedure de suivi/);
  });

  it("TOO_SHORT : message dedie, 0 appel IA", async () => {
    const { generate, calls } = fakeGenerate("- ne devrait pas etre appele");
    const outcome = await summarizeResource({
      source: readySource({ chunks: ["document minuscule."] }),
      deps: { generate },
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.bullets.length, 0);
    assert.equal(outcome.message, SUMMARY_MESSAGES.tooShort);
    assert.equal(calls.length, 0);
  });

  it("NOT_READY : statut different de Pret -> refus sans appel IA", async () => {
    for (const status of ["En cours", "Échec", ""]) {
      const { generate, calls } = fakeGenerate("- ignored");
      const outcome = await summarizeResource({
        source: readySource({ status }),
        deps: { generate },
      });
      assert.equal(outcome.ok, false, `statut ${status}`);
      assert.equal(outcome.message, SUMMARY_MESSAGES.notReady);
      assert.equal(calls.length, 0);
    }
  });

  it("GEN_FAILURE : exception du modele -> relance puis message FR, aucune puce", async () => {
    const { generate, calls } = fakeGenerate("", { throws: true });
    const outcome = await summarizeResource({ source: readySource(), deps: { generate } });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.bullets.length, 0);
    assert.equal(outcome.message, SUMMARY_MESSAGES.generationFailure);
    // Une relance unique est tentee avant d'abandonner (fiabilite 2026-09-27).
    assert.equal(calls.length, 2);
  });

  it("relance quand le modele repond vide (reponse vide observee en live)", async () => {
    let calls = 0;
    const outcome = await summarizeResource({
      source: readySource(),
      deps: {
        generate: async () => {
          calls += 1;
          // Premier appel : 0 caractère (symptôme observé) ; second : correct.
          return calls === 1
            ? ""
            : ["- un", "- deux", "- trois", "- quatre", "- cinq"].join("\n");
        },
      },
    });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.bullets.length, 5);
    assert.equal(calls, 2, "exactement une relance, pas davantage");
  });

  it("abandon apres la relance si le modele reste vide", async () => {
    let calls = 0;
    const outcome = await summarizeResource({
      source: readySource(),
      deps: {
        generate: async () => {
          calls += 1;
          return "";
        },
      },
    });
    assert.equal(outcome.ok, false);
    assert.equal(calls, 2);
    assert.equal(outcome.message, SUMMARY_MESSAGES.emptyGeneration);
  });

  it("GEN_FAILURE : reponse vide ou sans puce -> message dedie", async () => {
    const { generate } = fakeGenerate("Le document parle de gestion de projet.");
    const outcome = await summarizeResource({ source: readySource(), deps: { generate } });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.message, SUMMARY_MESSAGES.emptyGeneration);
  });

  it("signale un resume partiel quand la source depasse le plafond", async () => {
    const { generate } = fakeGenerate("- une puce");
    const outcome = await summarizeResource({
      source: readySource({ chunks: ["y".repeat(MAX_SOURCE_CHARS + 100)] }),
      deps: { generate },
    });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.partial, true);
    assert.equal(outcome.message, SUMMARY_MESSAGES.partial);
  });
});

describe("action serveur — garanties structurelles (audit statique)", () => {
  const actionSrc = readFileSync(
    join(root, "app/(dashboard)/resources/[id]/actions.ts"),
    "utf8",
  );

  it("UNAUTH : la garde de session precede tout appel IA (0 appel Gemini)", () => {
    const guard = actionSrc.indexOf("if (!user) return failure(SUMMARY_MESSAGES.unauthorized)");
    const call = actionSrc.indexOf("summarizeResource({");
    assert.ok(guard > -1, "garde de session absente");
    assert.ok(call > -1, "appel de synthese absent");
    assert.ok(guard < call, "la garde de session doit preceder l'appel IA");
  });

  it("AC « aucune ecriture » : l'action ne contient ni insert, ni update, ni delete", () => {
    for (const verb of [".insert(", ".update(", ".delete(", ".upsert("]) {
      assert.ok(
        !actionSrc.includes(verb),
        `ecriture detectee (${verb}) : le resume ne doit jamais etre persiste`,
      );
    }
  });

  it("la redirection de session n'est pas dans un try (sinon 404 silencieux)", () => {
    const ficheSrc = readFileSync(
      join(root, "app/(dashboard)/resources/[id]/page.tsx"),
      "utf8",
    );
    const redirectAt = ficheSrc.indexOf('redirect("/login")');
    const firstTry = ficheSrc.indexOf("try {");
    assert.ok(redirectAt > -1, "redirection /login absente");
    assert.ok(firstTry > -1, "aucun try attendu");
    assert.ok(
      redirectAt < firstTry,
      "redirect() leve une erreur Next : place dans un try, le catch la masque en 404",
    );
  });
});


    const bullets = parseBullets(
      "Voici la synthese :\n\n- seul point cle\nUne phrase parasite.",
    );
    assert.deepEqual(bullets, ["seul point cle"]);
  });

  it("plafonne a MAX_BULLETS (AC 5 a 8)", () => {
    const raw = Array.from({ length: 12 }, (_, i) => `- puce ${i + 1}`).join("\n");
    assert.equal(parseBullets(raw).length, MAX_BULLETS);
  });

  it("renvoie un tableau vide sur une reponse sans puce", () => {
    assert.deepEqual(parseBullets(""), []);
    assert.deepEqual(parseBullets("aucun point cle ici"), []);
  });

  it("retire l'emphase markdown enveloppante (rendu texte brut)", () => {
    assert.deepEqual(parseBullets("- **Lock-in** : migration impossible"), [
      "Lock-in : migration impossible",
    ]);
    assert.deepEqual(parseBullets("- `65 EUR` par heure"), ["65 EUR par heure"]);
  });

  it("emphase jamais fermee : aucun asterisque ne survit a l'ecran", () => {
    // Le modele emit parfois « **Important : ... » sans fermant. L'ancienne
    // sanitisation laissait les asterisques bruts dans la puce.
    assert.deepEqual(parseBullets("- **Important prevoir un badge"), [
      "Important prevoir un badge",
    ]);
    assert.deepEqual(parseBullets("- __Periode d'essai__ : 3 mois"), [
      "Periode d'essai : 3 mois",
    ]);
  });
});
