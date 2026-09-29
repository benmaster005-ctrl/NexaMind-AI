# NexaMind AI

Base documentaire intelligente de NexaWorks : recherche sémantique et question-réponse
(RAG) avec citations, sur les documents déposés par les utilisateurs. Tout compte
authentifié peut déposer et gérer un document depuis `/documents` : il n'y a **pas de
gestion des rôles**. Stack : Next.js 16 (App Router, `proxy.ts`), Supabase
(Auth + Postgres/pgvector + Storage), Google Gemini.

## Démarrer

```bash
cp .env.example .env.local   # URL + clé publique Supabase, GEMINI_API_KEY
npm ci
npm run dev                  # http://localhost:3000
```

Appliquer d'abord les migrations SQL de `supabase/migrations/` dans l'ordre : la
procédure complète est dans **`DEPLOYMENT.md`**.

## Vérifications

```bash
npm run typecheck   # next typegen + tsc --noEmit
npm run lint
npm run test        # tests node --test (sans réseau)
npm run build
```

## Déployer sur Vercel

**Lire `DEPLOYMENT.md`** : version de Node, variables d'environnement, migrations,
durées maximales des fonctions, et **la limite de 4 Mo du dépôt de
documents** — un plafond de corps de requête côté hébergeur, qui ne se règle pas dans
`next.config.ts`.

---

Projet [Next.js](https://nextjs.org) ; documentation du framework sur
[nextjs.org](https://nextjs.org/docs).
