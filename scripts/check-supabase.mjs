import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Contrôle de connexion Supabase en LECTURE SEULE (aucune écriture distante).
 * Usage : `node scripts/check-supabase.mjs`
 * Vérifie que l'URL répond et que la clé publique est acceptée.
 * Ne crée ni table ni permission : le DDL passe par le SQL Editor (voir sortie).
 */

// Charge .env.local (à côté de package.json) sans dépendance externe.
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
} catch {
  // Pas bloquant : le contrôle ci-dessous signalera les variables manquantes.
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

if (!url || !key) {
  console.error(
    "MANQUANT : NEXT_PUBLIC_SUPABASE_URL et/ou clé publique. " +
      "Copiez .env.example vers .env.local.",
  );
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/health`, {
  headers: { apikey: key },
});
console.log(`AUTH ${url}/auth/v1/health -> HTTP ${res.status}`);
if (res.status !== 200) {
  console.error(
    "Projet injoignable ou clé non reconnue : vérifiez que le projet n'est pas en pause et que l'URL et la clé viennent de la même page Project Settings > API.",
  );
  process.exit(1);
}
const stor = await fetch(`${url}/storage/v1/bucket`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const storBody = await stor.text();
console.log(`STORAGE ${url}/storage/v1/bucket -> HTTP ${stor.status}`);
if (stor.status > 299) {
  console.error("Clé rejetée par le stockage : vérifiez la clé publique du projet.");
  process.exit(1);
}
console.log(`Buckets visibles : ${storBody.slice(0, 200)}`);
const tbl = await fetch(`${url}/rest/v1/resources?select=id&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const tblBody = await tbl.text();
console.log(`TABLE resources -> HTTP ${tbl.status} ${tblBody.slice(0, 160)}`);
if (tbl.status === 200) {
  console.log("Table resources : PRESENTE.");
} else {
  console.log(
    "Table resources : ABSENTE ou non lisible en anonyme -> exécutez supabase/migrations/0001_init.sql dans Dashboard > SQL Editor > Run " +
      "(la clé publique ne permet pas le DDL).",
  );
}
console.log("Connexion acceptée : le projet Supabase répond à la clé publique.");
