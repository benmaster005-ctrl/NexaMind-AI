import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { decideRouteGuard } from "@/lib/auth/route-guard";

/**
 * Middleware de session et de protection des routes Supabase (story 1.3).
 *
 * 1. Entretient les cookies de session (rafraichissement Supabase SSR).
 * 2. Applique la garde FR-3 via decideRouteGuard : / exige une session,
 *    /admin/* exige en plus le role 'admin' (redirection vers / sinon).
 *    Session expiree ou absente = pas de session -> /login.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decideRouteGuard({
    pathname: request.nextUrl.pathname,
    hasSession: user !== null,
    // `app_metadata` uniquement : `user_metadata` est modifiable par
    // l'utilisateur (escalade de privileges, cf. migration 0008).
    role: user?.app_metadata?.["role"],
  });

  if (!decision.allowed) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = decision.redirectTo;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
