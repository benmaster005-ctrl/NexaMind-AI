// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit statique de securite (2026-09-27, apres les corrections critiques).
 *
 * Execute avec `npm run test:security`, hors reseau. Il verrouille les trois
 * corrections de l'audit :
 *   1. le role n'est plus lu dans `user_metadata` (modifiable par l'utilisateur) ;
 *   2. les policies d'ecriture RLS sont reservees a l'admin (migration 0008) ;
 *   3. les en-tetes de securite HTTP sont poses par next.config.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

/** Liste recursive des sources applicatives (hors tests). */
function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) sourceFiles(rel, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) acc.push(rel);
  }
  return acc;
}

const SOURCES = [
  ...sourceFiles("app"),
  ...sourceFiles("lib"),
  ...sourceFiles("components"),
  // Next 16 : la convention `middleware.ts` est devenue `proxy.ts`.
  "proxy.ts",
];

/**
 * Code sans commentaires : les commentaires citent volontairement
 * `user_metadata` (et `dangerouslySetInnerHTML`) pour expliquer les
 * interdictions — un audit doit porter sur le code, pas sur la prose.
 */
function codeOnly(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    // `[^\n]*` et non `.*$` : les fichiers sont en CRLF, `$` ne matche pas
    // avant le `\r` et le commentaire passerait intact.
    .map((line) => line.replace(/(^|[^:])\/\/[^\n]*/, "$1"))
    .join("\n");
}

describe("1. Source de verite du role (escalade de privileges)", () => {
  it("aucun code applicatif ne lit user_metadata", () => {
    const offenders = SOURCES.filter((file) => /user_metadata/.test(codeOnly(file)));
    assert.deepEqual(offenders, [], `user_metadata lu dans : ${offenders.join(", ")}`);
  });

  it("les points de controle de role lisent app_metadata", () => {
    const guardFiles = [
      "lib/supabase/middleware.ts",
      "app/(dashboard)/admin/resources/actions.ts",
      "app/(dashboard)/resources/[id]/page.tsx",
      "app/page.tsx",
      "app/chat/page.tsx",
      "app/chat/[id]/page.tsx",
      "app/search/page.tsx",
      "app/(dashboard)/history/page.tsx",
    ];
    for (const file of guardFiles) {
      assert.match(read(file), /app_metadata/, file);
    }
  });

  it("l'inscription n'envoie plus de role au client", () => {
    const auth = read("app/(auth)/actions.ts");
    assert.ok(
      !/options:\s*\{\s*data:\s*\{\s*role/.test(auth),
      "l'inscription ne doit pas proposer le role (escalade)",
    );
  });
});

describe("2. RLS : les ecritures sont reservees a l'admin (migration 0008)", () => {
  const lower = read("supabase/migrations/0008_admin_only_writes.sql").toLowerCase();

  it("is_admin() s'appuie sur app_metadata du JWT", () => {
    assert.match(lower, /create or replace function public\.is_admin\(\)/);
    assert.match(lower, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/);
  });

  it("aucune policy d'ecriture ne reste ouverte a tous les authentifies", () => {
    const wideOpen = [
      /for insert to authenticated with check \(true\)/,
      /for update to authenticated\s+using \(true\)/,
      /for delete to authenticated using \(true\)/,
    ].filter((re) => re.test(lower));
    assert.deepEqual(wideOpen.map(String), [], "policy d'ecriture encore ouverte");
  });

  it("chaque ecriture (resources, chunks, storage) est gardee par is_admin()", () => {
    for (const table of ["public.resources", "public.document_chunks", "storage.objects"]) {
      const blocks = lower
        .split(` on ${table};`)
        .join(" on @@;")
        .split("@@")
        .filter((b) => /for (insert|update|delete)/.test(b));
      assert.ok(blocks.length > 0, `aucune policy d'ecriture sur ${table}`);
      for (const block of blocks) {
        assert.match(block, /public\.is_admin\(\)/, `ecriture non gardee sur ${table}`);
      }
    }
  });

  it("le trigger d'inscription neutralise le role fourni par le client", () => {
    assert.match(lower, /create trigger on_auth_user_created/);
    assert.match(lower, /raw_user_meta_data = coalesce\(raw_user_meta_data, '\{\}'::jsonb\) - 'role'/);
    assert.match(lower, /jsonb_build_object\('role', 'collaborateur'\)/);
  });
});

describe("3. En-tetes de securite HTTP", () => {
  const config = read("next.config.ts");

  it("pose CSP, anti-framing et anti-sniffing", () => {
    for (const needle of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "poweredByHeader: false",
    ]) {
      assert.ok(config.includes(needle), `en-tete manquant : ${needle}`);
    }
  });

  it("n'autorise pas une origine arbitraire dans connect-src", () => {
    assert.match(config, /connect-src 'self' \$\{supabaseOrigin\}/);
    assert.ok(!/connect-src[^`]*\*/.test(config), "connect-src ne doit pas etre un joker");
  });
});

describe("4. Secrets et rendu", () => {
  it("aucune cle Gemini dans un composant client", () => {
    for (const file of SOURCES.filter((f) => f.startsWith("components"))) {
      assert.ok(
        !/GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY/.test(read(file)),
        `cle secrate referencee dans ${file}`,
      );
    }
  });

  it("aucun HTML brut rendu (dangerouslySetInnerHTML)", () => {
    const offenders = SOURCES.filter((file) => /dangerouslySetInnerHTML/.test(codeOnly(file)));
    assert.deepEqual(offenders, [], offenders.join(", "));
  });
});
