import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { postAuthPath } from "@/features/auth/destination";

const TYPES: readonly EmailOtpType[] = ["signup", "recovery", "invite", "email_change", "magiclink", "email"];

/**
 * Every e-mail link lands here, in either shape:
 * - NIVO templates (custom SMTP): `token_hash` + `type` (+ `next`, which may itself be this route's URL);
 * - Supabase's default templates (no custom SMTP yet): Supabase verifies, then returns here with a PKCE `code`.
 * The token becomes a session cookie, then: recovery -> /reset-password, anything else -> `next` or the dashboard.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const next = unwrapNext(searchParams.get("next"), origin);
  const isRecovery = searchParams.get("type") === "recovery" || next?.startsWith("/reset-password") === true;
  const fail = () => NextResponse.redirect(new URL(isRecovery ? "/reset-password?error=invalid" : "/login?error=link_expired", origin));
  if (searchParams.get("error_code") ?? searchParams.get("error")) return fail();

  const supabase = await supabaseServer();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
  } else if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail();
  } else {
    return fail();
  }
  if (isRecovery) return NextResponse.redirect(new URL("/reset-password", origin));
  return NextResponse.redirect(new URL(await postAuthPath(supabase, next, origin), origin));
};

/** `{{ .RedirectTo }}` can be this route's own URL (`/auth/confirm?next=/x`); keep only the inner destination. */
const unwrapNext = (raw: string | null, origin: string): string | null => {
  if (!raw) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin && url.pathname === "/auth/confirm") return url.searchParams.get("next");
    return url.origin === origin ? `${url.pathname}${url.search}` : raw;
  } catch {
    return raw;
  }
};
