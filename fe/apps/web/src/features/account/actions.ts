"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { account } from "@/i18n/dict/account";
import { publicConfig } from "@/lib/config";
import { revokeMySession, sessionIdFromToken, syncMemberDisplayName } from "@/lib/account";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authed = async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
};

/** Display name: auth metadata first (the shell reads it), then the member row. */
export const updateProfile = async (name: string): Promise<Outcome<null>> => {
  const t = await getT(account);
  const displayName = name.trim();
  if (displayName.length < 2) return { ok: false, error: t("errName") };
  const { supabase, user } = await authed();
  const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
  if (error) return { ok: false, error: error.message };
  await syncMemberDisplayName(supabase, user.id, displayName);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
};

/** Sends the confirmation link; the address changes only after the link is opened (/auth/confirm). */
export const changeEmail = async (email: string): Promise<Outcome<null>> => {
  const t = await getT(account);
  const next = email.trim().toLowerCase();
  if (!EMAIL.test(next)) return { ok: false, error: t("errEmail") };
  const { supabase, user } = await authed();
  if (next === user.email?.toLowerCase()) return { ok: false, error: t("errEmailSame") };
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${origin}/auth/confirm?next=/account` });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
};

/** Re-authenticates with the current password on a throwaway client (the browser session is untouched), then sets the new one. */
export const changePassword = async (current: string, next: string, confirm: string): Promise<Outcome<null>> => {
  const t = await getT(account);
  if (!current) return { ok: false, error: t("errCurrent") };
  if (next.length < MIN_PASSWORD) return { ok: false, error: t("errMin") };
  if (next !== confirm) return { ok: false, error: t("errMatch") };
  if (next === current) return { ok: false, error: t("errSameAsOld") };
  const { supabase, user } = await authed();
  if (!user.email) return { ok: false, error: t("errNoPassword") };
  const probe = createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = await probe.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { ok: false, error: t("errWrongCurrent") };
  await probe.auth.signOut(); // drop the verification session so it never shows up in the device list
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
};

/** Signs out another device; refuses the current session (use {@link signOutCurrent}). */
export const revokeSession = async (sessionId: string): Promise<Outcome<null>> => {
  const t = await getT(account);
  const { supabase } = await authed();
  const { data } = await supabase.auth.getSession();
  if (sessionIdFromToken(data.session?.access_token) === sessionId) return { ok: false, error: t("unknownError") };
  try {
    await revokeMySession(supabase, sessionId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : t("unknownError") };
  }
  revalidatePath("/account");
  return { ok: true, data: null };
};

export const signOutOthers = async (): Promise<Outcome<null>> => {
  const { supabase } = await authed();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account");
  return { ok: true, data: null };
};

export const signOutCurrent = async (): Promise<void> => {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
};
