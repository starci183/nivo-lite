import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { postAuthPath } from "@/features/auth/destination";

/** OAuth / PKCE return: exchange the code for a session, then go to `next` (or the console). */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(providerError === "access_denied" ? "oauth_denied" : "link_expired")}`, origin));
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  return NextResponse.redirect(new URL(await postAuthPath(supabase, searchParams.get("next"), origin), origin));
};
