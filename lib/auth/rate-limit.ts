/**
 * Garde anti-attaque par force brute (MVP local, story 1.2).
 *
 * Principe : apres 5 tentatives echouees consecutives pour une meme cle
 * (adresse e-mail ou adresse IP), toute nouvelle tentative est bloquee
 * pendant une duree fixe. Un succes reinitialise le compteur.
 *
 * Limite connue et documentee : stockage en memoire du processus Node.
 * En deploiement multi-instances, chaque instance a son propre compteur.
 * Suffisant pour le MVP local ; une solution partagee (ex. Redis/Upstash,
 * deja prevue en "Deferred" de l'architecture) sera necessaire en production.
 */

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes (hypothese PRD §11 n.4)

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
}

/** Compteur en memoire : cle normalisee -> releve de tentatives. */
const attempts = new Map<string, AttemptRecord>();

export interface RateLimitDecision {
  /** true = la tentative est autorisee, false = bloquee temporairement. */
  allowed: boolean;
  /** Nombre d'essais restants avant blocage (0 quand bloque). */
  remainingAttempts: number;
  /** Delai d'attente en secondes avant de reessayer (0 si autorise). */
  retryAfterSeconds: number;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function getOrCreate(key: string): AttemptRecord {
  let record = attempts.get(key);
  if (!record) {
    record = { failures: 0, lockedUntil: null };
    attempts.set(key, record);
  }
  return record;
}

/**
 * Verifie si une tentative est autorisee pour la cle donnee.
 * Ne modifie pas le compteur : appelez `recordFailure()` ou `recordSuccess()`
 * apres le resultat reel de la tentative d'authentification.
 */
export function checkRateLimit(key: string): RateLimitDecision {
  const record = getOrCreate(normalizeKey(key));
  const now = Date.now();

  if (record.lockedUntil !== null) {
    if (now < record.lockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
      };
    }
    // Le verrou a expire : on supprime l'entree pour eviter
    // une croissance illimitee de la Map en memoire.
    attempts.delete(normalizeKey(key));
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.failures),
    retryAfterSeconds: 0,
  };
}

/** A appeler apres un echec d'authentification. */
export function recordFailure(key: string): void {
  const record = getOrCreate(normalizeKey(key));
  record.failures += 1;
  if (record.failures >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
}

/** A appeler apres un succes d'authentification : reinitialise le compteur. */
export function recordSuccess(key: string): void {
  attempts.delete(normalizeKey(key));
}

/** Expose en test uniquement : vide tout le compteur en memoire. */
export function resetRateLimitForTests(): void {
  attempts.clear();
}

export const RATE_LIMIT_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const RATE_LIMIT_LOCK_DURATION_MS = LOCK_DURATION_MS;
