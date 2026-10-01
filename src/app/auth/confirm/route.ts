import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { postAuthPath } from "@/features/auth/destination";

const TYPES: readonly EmailOtpType[] = ["signup", "recovery", "invite", "email_change", "magiclink", "email"];

/**
 * E-mail link landing (`token_hash` + `type`, see supabase/templates). Verifies the token into a session cookie, then:
 * recovery -> /reset-password, anything else -> `next` (an invite page, say) or the dashboard.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fail = (path: string) => NextResponse.redirect(new URL(path, origin));
  const isRecovery = type === "recovery";
  if (!tokenHash || !type || !TYPES.includes(type)) return fail(isRecovery ? "/reset-password?error=invalid" : "/login?error=link_expired");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return fail(isRecovery ? "/reset-password?error=invalid" : "/login?error=link_expired");
  if (isRecovery) return NextResponse.redirect(new URL("/reset-password", origin));
  return NextResponse.redirect(new URL(await postAuthPath(supabase, searchParams.get("next"), origin), origin));
};
