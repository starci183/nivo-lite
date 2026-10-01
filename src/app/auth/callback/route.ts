import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** OAuth return: exchange the code for a session, then enter the console. */
export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=Missing%20sign-in%20code", origin));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin));
  return NextResponse.redirect(new URL("/dashboard", origin));
};
