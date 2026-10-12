"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { AuthErrorCode } from "@/i18n/dict/auth";
import { postAuthPath } from "./destination";
import { safeNext } from "./next";

/** Result every auth action returns: a typed code the client turns into friendly vi/en copy. */
export type AuthResult = { readonly ok: true } | { readonly ok: false; readonly code: AuthErrorCode };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ok: AuthResult = { ok: true };

const codeOf = (error: { code?: string; status?: number; message?: string }): AuthErrorCode => {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "too_many";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "otp_expired":
    case "bad_jwt":
    case "session_not_found":
      return "link_invalid";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signup_disabled";
    default:
      return error.status === 429 ? "too_many" : "generic";
  }
};

/** The public origin used in e-mail links (request origin, else NEXT_PUBLIC_SITE_URL). */
const siteOrigin = async (): Promise<string> => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
};

/** E-mail links come back through /auth/confirm, which turns the token (or PKCE code) into a session first. */
const confirmUrl = (origin: string, next: string): string => `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

/** Password sign-in; on success go to `next` (or the dashboard). */
export const signInWithPassword = async (input: { email: string; password: string; next?: string }): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || !input.password) return { ok: false, code: "invalid_credentials" };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) return { ok: false, code: codeOf(error) };
  redirect(await postAuthPath(supabase, input.next));
};

/** Create a password account; Supabase sends the confirmation e-mail (no session until it is confirmed). */
export const signUpWithPassword = async (input: { name: string; email: string; password: string; next?: string }): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (name.length < 2 || !EMAIL_RE.test(email) || input.password.length < 8) return { ok: false, code: "generic" };
  const supabase = await supabaseServer();
  const next = safeNext(input.next);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: name }, emailRedirectTo: confirmUrl(await siteOrigin(), next) },
  });
  if (error) return { ok: false, code: codeOf(error) };
  // Confirmations off (or auto-confirm): a session exists already. Otherwise the confirm screen takes over.
  if (data.session) redirect(await postAuthPath(supabase, input.next));
  return ok;
};

/** Send the signup confirmation e-mail again. */
export const resendConfirmation = async (input: { email: string; next?: string }): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, code: "generic" };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmUrl(await siteOrigin(), safeNext(input.next)) },
  });
  return error ? { ok: false, code: codeOf(error) } : ok;
};

/** Send a password-reset link. Always answers ok for a well-formed e-mail so accounts cannot be enumerated. */
export const requestPasswordReset = async (input: { email: string }): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, code: "generic" };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: confirmUrl(await siteOrigin(), "/reset-password") });
  if (error && codeOf(error) === "too_many") return { ok: false, code: "too_many" };
  return ok;
};

/** Set a new password for the user who arrived through the recovery link, then ask them to sign in. */
export const updatePassword = async (input: { password: string }): Promise<AuthResult> => {
  if (input.password.length < 8) return { ok: false, code: "weak_password" };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, code: "link_invalid" };
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { ok: false, code: codeOf(error) };
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?notice=reset");
};
