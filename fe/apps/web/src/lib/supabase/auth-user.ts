import "server-only";
import { cache } from "react";
import { supabaseServer } from "./server";

/** The signed-in person as the access token states it. */
export type AuthUser = { id: string; email: string; metadata: { full_name?: string; name?: string; avatar_url?: string } };

/**
 * Who is signed in, WITHOUT a network round trip (about 220 ms from the Netlify region to Supabase).
 * `getClaims()` verifies the access token's signature against the project's published signing key (cached in memory) and
 * its expiry, so the identity cannot be forged. It does not ask Auth whether the session was revoked: a sign-out elsewhere
 * is noticed when the token next refreshes (the proxy does that, at most an hour). Money and account-security actions
 * keep calling `auth.getUser()` directly. Runs once per request (React cache); null when signed out.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    metadata: (claims.user_metadata ?? {}) as AuthUser["metadata"],
  };
});
