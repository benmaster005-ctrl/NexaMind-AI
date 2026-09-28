import type { NextConfig } from "next";

import { MAX_UPLOAD_BYTES } from "./lib/resources/validation";

/**
 * Marge ajoutee a la taille maximale du fichier pour la limite du corps de
 * requete : un envoi `multipart/form-data` ajoute ses boundary, en-tetes de
 * partie et metadonnees de champs autour des octets du fichier.
 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * En-tetes de securite (audit 2026-09-27).
 *
 * L'application affiche du contenu importe de fichiers tiers (extraction de
 * documents) : on verrouille ce que le navigateur a le droit de charger, on
 * interdit l framing (clickjacking) et on masque la pile technique.
 *
 * `connect-src` doit lister : le projet Supabase (auth + REST) et l'API
 * Google Gemini appelee depuis le navigateur... le navigateur n'appelle
 * jamais Gemini (generation uniquement cote serveur, AD-4) : seules les
 * origines Supabase suffisent.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inline les scripts de bootstrap : 'unsafe-inline' reste necessaire
  // en mode App Router classique ; le reste des sources est refuse.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Les styles sont des CSS Modules, mais Next injecte aussi des styles inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      /**
       * Depot documentaire (FR-5) : la limite par defaut du corps de requete
       * d'une Server Action est de 1 Mo, ce qui rejetterait les fichiers de
       * 4 Mo autorises par `MAX_UPLOAD_BYTES`. On aligne les deux regles sur
       * la meme constante : les relever ailleurs les ferait diverger
       * silencieusement (erreur plateau incomprehensible cote utilisateur).
       *
       * Le total reste sous le plafond hebergeur, qui ne se regle pas ici :
       * sur Vercel, le corps d'une requete envoyee a une fonction est limite a
       * 4,5 Mo (erreur 413 `function_payload_too_large`). 4 Mio + 64 Ko =
       * 4 259 328 octets, soit ~235 Ko de jeu sous ce plafond. `DEPLOYMENT.md`
       * indique la marche a suivre pour remonter a 10 Mo (televersement direct
       * du navigateur vers Supabase Storage, hors du corps de la requete).
       */
      bodySizeLimit: MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES,
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
