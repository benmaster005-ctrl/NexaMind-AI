// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit statique de la RPC match_chunks (plan 3.1, FR-9).
 * Execute avec `npm run test:search-rpc` (node --test, sans reseau
 * ni Supabase reel : on audite le fichier SQL versionne).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase/migrations/0005_match_chunks.sql"), "utf8");
const lower = sql.toLowerCase();

describe("match_chunks RPC (plan 3.1)", () => {
  it("definit la fonction avec les 3 parametres et le seuil 0.65 par defaut", () => {
    assert.match(sql, /create or replace function public\.match_chunks\s*\(/i);
    assert.match(sql, /query_embedding\s+float\[\]/i);
    assert.match(sql, /match_threshold\s+float\s+default\s+0\.65/i);
    assert.match(sql, /match_count\s+int\s+default\s+10/i);
  });

  it("retourne l'extrait exact + metadonnees tries par similarite decroissante", () => {
    assert.match(sql, /returns table\s*\(/i);
    for (const col of ["chunk_id", "resource_id", "title", "category", "created_at", "content", "similarity"]) {
      assert.ok(lower.includes(col), `colonne manquante : ${col}`);
    }
    assert.match(sql, /1\s*-\s*\(dc\.embedding\s*<=>\s*query_vec\)/i);
    assert.match(sql, /order by dc\.embedding\s*<=>\s*query_vec/i);
  });

  it("filtre strictement les ressources Pretes avec embeddings non nuls", () => {
    assert.match(sql, /r\.status\s*=\s*'Prête'/);
    assert.match(sql, /dc\.embedding\s+is\s+not\s+null/i);
    assert.match(sql, /join public\.resources r on r\.id\s*=\s*dc\.resource_id/i);
  });

  it("rejette les vecteurs invalides par une erreur SQL controlee", () => {
    assert.match(sql, /query_embedding is null/i);
    assert.match(sql, /raise exception 'match_chunks: query_embedding/i);
    assert.match(sql, /array_length\(query_embedding, 1\) is distinct from 768/i);
    assert.match(sql, /raise exception 'match_chunks: dimension invalide/i);
    assert.match(sql, /::vector\(768\)/i);
  });

  it("borne le seuil dans [0,1] et la limite dans [1,50]", () => {
    assert.match(sql, /greatest\(0\.0,\s*least\(1\.0,/i);
    assert.match(sql, /greatest\(1,\s*least\(50,/i);
  });

  it("verrouille l'acces aux authentifies (jamais anon)", () => {
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path\s*=\s*public/i);
    assert.match(sql, /revoke all on function public\.match_chunks/i);
    assert.match(sql, /grant execute on function public\.match_chunks/i);
    assert.match(sql, /to authenticated/i);
    assert.ok(!lower.includes("to anon") || lower.includes("revoke"), "anon ne doit pas etre grante");
  });
});
