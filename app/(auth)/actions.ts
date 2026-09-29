"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
} from "@/lib/auth/rate-limit";

export interface AuthActionResult {
  success: boolean;
  /** Message à afficher à l'utilisateur (erreur neutre ou info). */
  message?: string;
}

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MSG_EMAIL_INVALID = "Saisissez une adresse e-mail valide.";
const MSG_PASSWORD_SHORT =
  "Le mot de passe doit contenir au moins 8 caractères.";
const MSG_SIGNUP_NEUTRAL =
  "Inscription impossible avec cet e-mail. Essayez de vous connecter ou réessayez.";
const MSG_SIGNIN_NEUTRAL = "E-mail ou mot de passe incorrect.";
const MSG_RATE_LIMITED =
  "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
const MSG_NETWORK =
  "Problème de connexion. Vérifiez votre réseau et réessayez.";
const MSG_CHECK_EMAIL =
  "Compte créé. Vérifiez votre boîte e-mail pour confirmer votre compte avant de vous connecter.";

function readCredentials(formData: FormData): {
  email: string;
  password: string;
} {
  return {
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message);
}

/**
 * Inscription e-mail / mot de passe (FR-1).
 *
 * Les messages d'erreur sont neutres : ils ne révèlent jamais si un
 * e-mail est déjà inscrit (hypothèse PRD §11 n.3 : inscription ouverte).
 *
 * Evolutions : le role n'est plus choisi par le client (il ne l'a jamais ete
 * depuis 0008), puis la gestion des roles a ete supprimee (migration 0009) :
 * aucun role n'est pose ni lu. L'inscription et le depot exigent une simple
 * session authentifiee.
 */
export async function signUpAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const { email, password } = readCredentials(formData);

  if (!EMAIL_PATTERN.test(email)) {
    return { success: false, message: MSG_EMAIL_INVALID };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: MSG_PASSWORD_SHORT };
  }

  const rateKey = `signup:${email}`;
  if (!checkRateLimit(rateKey).allowed) {
    return { success: false, message: MSG_RATE_LIMITED };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      recordFailure(rateKey);
      return { success: false, message: MSG_SIGNUP_NEUTRAL };
    }

    recordSuccess(rateKey);

    // Confirmation e-mail active : pas de session immédiate.
    if (!data.session) {
      return { success: true, message: MSG_CHECK_EMAIL };
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return { success: false, message: MSG_NETWORK };
    }
    recordFailure(rateKey);
    return { success: false, message: MSG_SIGNUP_NEUTRAL };
  }

  redirect("/");
}

/**
 * Connexion e-mail/mot de passe (FR-2).
 * Message d'erreur neutre : ne précise jamais quel champ est faux.
 */
export async function signInAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const { email, password } = readCredentials(formData);

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return { success: false, message: MSG_SIGNIN_NEUTRAL };
  }

  const rateKey = `signin:${email}`;
  if (!checkRateLimit(rateKey).allowed) {
    return { success: false, message: MSG_RATE_LIMITED };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      recordFailure(rateKey);
      return { success: false, message: MSG_SIGNIN_NEUTRAL };
    }

    recordSuccess(rateKey);
  } catch (error) {
    if (isNetworkError(error)) {
      return { success: false, message: MSG_NETWORK };
    }
    recordFailure(rateKey);
    return { success: false, message: MSG_SIGNIN_NEUTRAL };
  }

  redirect("/");
}

/** Déconnexion : invalide la session puis renvoie vers /login. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
