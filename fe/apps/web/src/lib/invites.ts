"use server";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { team } from "@/i18n/dict/team";
import { invite as inviteDict } from "@/i18n/dict/invite";
import { publicConfig } from "./config";
import { logEvidence } from "./core";
import { listMembers, requireRole } from "./members";
import { WORKSPACE_COOKIE } from "./session";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";
import type { Outcome } from "./types";

/** How an invitation reached the person: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteDelivery = "invited" | "existing" | "none";
export type InviteResult = { email: string; link: string; delivery: InviteDelivery };

const INVITE_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

const siteUrl = async (): Promise<string> => {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
};

const fail = async (key: string): Promise<Outcome<never>> => {
  const t = await getT(team);
  return { ok: false, error: t(key as never) };
};

/** Send the invitation email. New person: Supabase invite (creates the account). Known person: a sign-in link. Never throws. */
const deliver = async (email: string, token: string): Promise<InviteDelivery> => {
  const redirectTo = `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(`/invite/${token}`)}`;
  try {
    const invited = await supabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!invited.error) return "invited";
    // Already has an account: a magic link takes them to the same invite page.
    const anon = createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const sent = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
    return sent.error ? "none" : "existing";
  } catch {
    return "none";
  }
};

const inviteLink = async (token: string) => `${await siteUrl()}/invite/${token}`;

/** Create an invitation (owner | manager). The token is returned once inside the link; only its SHA-256 hash is stored. */
export async function createInvite(input: { email: string; role: "manager" | "staff"; staffId: string | null }): Promise<Outcome<InviteResult>> {
  try {
    const me = await requireRole(["owner", "manager"]);
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return await fail("errEmail");
    if (input.role !== "manager" && input.role !== "staff") return await fail("errGeneric");
    const db = await supabaseServer();

    const members = await listMembers();
    if (members.some((m) => m.email.toLowerCase() === email)) return await fail("errAlreadyMember");

    if (input.staffId) {
      if (members.some((m) => m.staffId === input.staffId)) return await fail("errStaffTaken");
      const taken = await db.from("workspace_invites").select("id").eq("workspace_id", me.workspaceId).eq("staff_id", input.staffId)
        .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).neq("email", email).limit(1);
      if (taken.data?.length) return await fail("errStaffTaken");
    }

    // A newer invitation replaces any pending one for the same email.
    await db.from("workspace_invites").update({ revoked_at: new Date().toISOString() })
      .eq("workspace_id", me.workspaceId).ilike("email", email).is("accepted_at", null).is("revoked_at", null);

    const token = newToken();
    const { error } = await db.from("workspace_invites").insert({
      workspace_id: me.workspaceId, email, role: input.role, staff_id: input.staffId, token_hash: hashToken(token),
      invited_by: me.userId, expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    });
    if (error) return await fail("errGeneric");

    const delivery = await deliver(email, token);
    await logEvidence(db, me.workspaceId, { kind: "member.invited", actor: me.displayName, summary: `${email} · ${input.role}` });
    revalidatePath("/team");
    return { ok: true, data: { email, link: await inviteLink(token), delivery } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type InviteRow = { id: string; email: string; role: string; accepted_at: string | null; revoked_at: string | null };

/** Replace the invitation's token (the old link stops working) and extend its life. The raw token is only ever in the new link. */
const rotate = async (id: string): Promise<{ row: InviteRow; token: string; workspaceId: string; actor: string } | null> => {
  const me = await requireRole(["owner", "manager"]);
  const db = await supabaseServer();
  const token = newToken();
  const { data } = await db.from("workspace_invites")
    .update({ token_hash: hashToken(token), expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() })
    .eq("id", id).eq("workspace_id", me.workspaceId).is("accepted_at", null).is("revoked_at", null)
    .select("id, email, role, accepted_at, revoked_at");
  const row = (data as InviteRow[] | null)?.[0];
  return row ? { row, token, workspaceId: me.workspaceId, actor: me.displayName } : null;
};

/** "Gửi lại": new link, email sent again. */
export async function resendInvite(id: string): Promise<Outcome<InviteResult>> {
  try {
    const r = await rotate(id);
    if (!r) return await fail("errNotFound");
    const delivery = await deliver(r.row.email, r.token);
    await logEvidence(await supabaseServer(), r.workspaceId, { kind: "member.invite_resent", actor: r.actor, summary: r.row.email });
    revalidatePath("/team");
    return { ok: true, data: { email: r.row.email, link: await inviteLink(r.token), delivery } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** "Sao chép link mời": the stored hash cannot be reversed, so this issues a fresh link (the previous one stops working). */
export async function copyInviteLink(id: string): Promise<Outcome<InviteResult>> {
  try {
    const r = await rotate(id);
    if (!r) return await fail("errNotFound");
    revalidatePath("/team");
    return { ok: true, data: { email: r.row.email, link: await inviteLink(r.token), delivery: "none" } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** "Thu hồi": the link stops working immediately. */
export async function revokeInvite(id: string): Promise<Outcome<null>> {
  try {
    const me = await requireRole(["owner", "manager"]);
    const db = await supabaseServer();
    const { data } = await db.from("workspace_invites").update({ revoked_at: new Date().toISOString() })
      .eq("id", id).eq("workspace_id", me.workspaceId).is("accepted_at", null).is("revoked_at", null).select("email");
    const email = (data as Array<{ email: string }> | null)?.[0]?.email;
    if (!email) return await fail("errNotFound");
    await logEvidence(db, me.workspaceId, { kind: "member.invite_revoked", actor: me.displayName, summary: email });
    revalidatePath("/team");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Accept as the signed-in user (the database checks token, expiry, revocation and that the emails match). */
export async function acceptInvite(token: string): Promise<Outcome<{ workspaceId: string }>> {
  const t = await getT(inviteDict);
  try {
    const db = await supabaseServer();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return { ok: false, error: t("failed") };
    const { data, error } = await db.rpc("accept_invite", { token });
    if (error) {
      const known: Record<string, string> = {
        invite_invalid: "invalidTitle", invite_revoked: "revokedTitle", invite_used: "usedTitle",
        invite_expired: "expiredTitle", invite_email_mismatch: "mismatchTitle",
      };
      const key = Object.keys(known).find((k) => error.message.includes(k));
      return { ok: false, error: key ? t(known[key] as never) : t("failed") };
    }
    const workspaceId = String(data);
    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    const name = (auth.user.user_metadata as { full_name?: string } | null)?.full_name || auth.user.email || "member";
    await logEvidence(db, workspaceId, { kind: "member.joined", actor: name, summary: auth.user.email ?? "" });
    revalidatePath("/", "layout");
    return { ok: true, data: { workspaceId } };
  } catch {
    return { ok: false, error: t("failed") };
  }
}
