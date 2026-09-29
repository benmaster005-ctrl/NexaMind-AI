# Rapport de validation MVP — 2026-09-27

Validation de bout en bout du MVP sur le serveur de developpement reel, la base
Supabase reelle et le vrai Gemini, avec le compte administrateur du projet.

Commande reproductible : `npm run validate:mvp-live`
(creneaux : `VALIDATE_EMAIL` / `VALIDATE_PASSWORD`, serveur dev sur `:3000`).

**Resultat : 56/56 verifications OK** — les 16 exigences du PRD (FR-1 a FR-16)
sont couvertes, plus les ecarts de l'epic 6 (consultation et passage cite).

| FR | Exigence | Verifications | Etat |
|----|----------|---------------|-------|
| FR-1 | Creer un compte | 1/1 | ✅ |
| FR-2 | Se connecter (+ anti-force brute) | 3/3 | ✅ |
| FR-3 | Proteger les acces, se deconnecter | 3/3 | ✅ (corrige) |
| FR-4 | Tableau de bord conditionne au role | 4/4 | ✅ |
| FR-5 | Deposer une ressource (admin) | 2/2 | ✅ |
| FR-6 | Ingester et indexer | 4/4 | ✅ |
| FR-7 | Consulter, organiser, retirer | 4/4 | ✅ (corrige) |
| FR-8 | Rechercher une ressource | 7/7 | ✅ (corrige) |
| FR-9 | Retrouver par le sens | 1/1 | ✅ |
| FR-10 | Reponse fondee sur les ressources | 2/2 | ✅ |
| FR-11 | Montrer ses sources | 5/5 | ✅ |
| FR-12 | S'abstenir plutot qu'inventer | 2/2 | ✅ |
| FR-13 | Garder le fil d'une conversation | 3/3 | ✅ |
| FR-14 | Resumer une ressource | 6/6 | ✅ |
| FR-15 | Retrouver et rouvrir ses conversations | 4/4 | ✅ |
| FR-16 | Retrouver ses recherches passees | 5/5 | ✅ |

## Defauts reels detectes et corriges par cette validation

1. **R-1 non applique aux pages applicatives** — `/search`, `/chat`, `/history`
   repondaient **200 sans session** (seules `/` et `/admin/*` etaient gardees).
   Les donnees restaient protegees par la RLS, mais l'interface etait exposee.
   *Correction :* `lib/auth/route-guard.ts` exige desormais une session sur
   `/search`, `/chat`, `/history`, `/resources` (3 tests ajoutes).
2. **Seuil de recherche par defaut inoperant** — `clampThreshold(null)` faisait
   `Number(null) === 0` : le seuil tombait a 0 au lieu de 0,65, donc des
   correspondances hors sujet a 0,50 etaient affichees ; `clampLimit(null)`
   limitait l'API a 1 resultat au lieu de 10.
   *Correction :* garde sur `null`/`undefined`/chaine vide (8 assertions
   ajoutees dans `scripts/search.test.ts`).

## Points de conformite partielle (a assumer)

- **FR-1 (inscription)** : le projet a `mailer_autoconfirm = false`. Le flux
  `signUp` est verifie dans le code et un compte reel existe, mais une
  inscription automatisee de bout en bout est impossible sans boite mail.
- **FR-2 (anti-force brute)** : le verrou est applique par l'action de
  connexion, non appelable en HTTP simple. La presence de la garde est verifiee
  par audit du code, sa logique par `npm run test:rate-limit`. Limite connue :
  compteur en memoire du processus (non partage entre instances).
- **FR-5 (depot)** : l'action serveur n'est pas appelable en HTTP simple ; le
  parcours equivalent (bucket + fiche + ingestion) est rejoue tel quel et la
  garde de role est auditee dans l'action.
- **Cas limite PRD « source retiree »** : non implemente. Apres suppression
  d'une ressource citee, la reponse reste lisible (extrait conserve dans
  `meta`), mais le lien « Ouvrir dans le document » mene a une 404 au lieu
  d'afficher « source retiree ».

## Addendum du 2026-09-29 — perimetre partiellement perime

Ce rapport reste **exact pour sa date** (2026-09-27) : il n'est pas reecrit. Deux
changements posterieurs rendent son perimetre partiellement obsolete, sans
invalider ses constats fonctionnels :

1. **Gestion des roles supprimee** (commit `376d3b2`). La ligne FR-4
   (« Tableau de bord conditionne au role ») et la mention du « compte
   administrateur » ne decrivent plus l'application : **tout compte authentifie**
   accede a tout, y compris au depot documentaire.
2. **`/admin/resources` devenu `/documents`.** La route d'administration
   n'existe plus ; le libelle de l'epic 7 et les entrees `deferred-work.md` des
   lots 3 et 4 sont corriges en consequence.
3. **Refonte du tableau de bord** (2026-09-29, commit `c1f4172`) : l'ecran
   d'accueil ne correspond plus a la description de ce rapport.

**Non rejoue a ce jour :** `npm run validate:mvp-live` (56/56) et
`npm run validate:chat-live` (14/14) n'ont pas ete rejoues apres ces trois
changements : ils exigent un serveur de developpement et un compte reel. La
revalidation est planifiee dans la story 7.10 (voir `deferred-work.md`).

## Effets de bord de la validation

- Une ressource temporaire « Validation MVP <horodatage » est deposee, ingeree,
  verifiee puis supprimee (fiche, morceaux et fichier Storage).
- Des conversations et une entree d'historique de recherche sont creees dans le
  compte de test (visibles, supprimables).
- Les comptes anonymes tentant `/search`, `/chat`, `/history` ou `/resources`
  sont desormais renvoyes vers `/login`.
