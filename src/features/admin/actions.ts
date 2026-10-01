"use server";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { publicConfig } from "@/lib/config";
import { reportError } from "@/lib/errors";
import { audit, requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outcome } from "@/lib/types";

/**
 * Support actions of the team console. Each one re-checks the platform admin on the server, changes one thing, and writes platform_audit
 * (what changed, from and to). The page asks for confirmation before calling them; there is no impersonation.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
const fail = (error: string): Outcome<never> => ({ ok: false, error });

/** Manual extension for support: paid_until + N days (counted from today when the subscription already lapsed). */
export async function extendSubscription(workspaceId: string, days: number): Promise<Outcome<{ paidUntil: string }>> {
  try {
    const admin = await requirePlatformAdmin();
    if (!UUID.test(workspaceId)) return fail("Invalid workspace.");
    if (!Number.isInteger(days) || days < 1 || days > 366) return fail("Days must be a whole number from 1 to 366.");
    const db = supabaseAdmin();
    const { data: ws } = await db.from("workspaces").select("paid_until").eq("id", workspaceId).maybeSingle<{ paid_until: string | null }>();
    if (!ws) return fail("Workspace not found.");
    const base = ws.paid_until && new Date(ws.paid_until).getTime() > Date.now() ? new Date(ws.paid_until).getTime() : Date.now();
    const paidUntil = new Date(base + days * DAY_MS).toISOString();
    const { error } = await db.from("workspaces").update({ paid_until: paidUntil }).eq("id", workspaceId);
    if (error) return fail(error.message);
    await audit(admin, "workspace.extend", workspaceId, { days, from: ws.paid_until, to: paidUntil });
    revalidatePath(`/admin/${workspaceId}`);
    revalidatePath("/admin");
    return { ok: true, data: { paidUntil } };
  } catch (e) {
    await reportError("admin.extend", e, { workspaceId });
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Mark the workspace active or past_due (billing status only). */
export async function setWorkspaceStatus(workspaceId: string, status: "active" | "past_due"): Promise<Outcome<{ status: string }>> {
  try {
    const admin = await requirePlatformAdmin();
    if (!UUID.test(workspaceId)) return fail("Invalid workspace.");
    if (status !== "active" && status !== "past_due") return fail("Status must be active or past_due.");
    const db = supabaseAdmin();
    const { data: ws } = await db.from("workspaces").select("status").eq("id", workspaceId).maybeSingle<{ status: string }>();
    if (!ws) return fail("Workspace not found.");
    const { error } = await db.from("workspaces").update({ status }).eq("id", workspaceId);
    if (error) return fail(error.message);
    await audit(admin, "workspace.set_status", workspaceId, { from: ws.status, to: status });
    revalidatePath(`/admin/${workspaceId}`);
    revalidatePath("/admin");
    return { ok: true, data: { status } };
  } catch (e) {
    await reportError("admin.set_status", e, { workspaceId });
    return fail(e instanceof Error ? e.message : String(e));
  }
}

const siteUrl = async (): Promise<string> => {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100"}`;
};

/** Resend a pending invitation: a fresh link (the old one stops working) and the email again. Mirrors the owner's "Gửi lại". */
export async function resendWorkspaceInvite(workspaceId: string, inviteId: string): Promise<Outcome<{ email: string; delivery: "invited" | "existing" | "none" }>> {
  try {
    const admin = await requirePlatformAdmin();
    if (!UUID.test(workspaceId) || !UUID.test(inviteId)) return fail("Invalid invite.");
    const db = supabaseAdmin();
    const token = randomBytes(32).toString("base64url");
    const { data } = await db.from("workspace_invites")
      .update({ token_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date(Date.now() + 7 * DAY_MS).toISOString() })
      .eq("id", inviteId).eq("workspace_id", workspaceId).is("accepted_at", null).is("revoked_at", null)
      .select("email");
    const email = (data as Array<{ email: string }> | null)?.[0]?.email;
    if (!email) return fail("That invitation is no longer pending.");

    const redirectTo = `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(`/invite/${token}`)}`;
    let delivery: "invited" | "existing" | "none" = "none";
    try {
      const invited = await db.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (!invited.error) delivery = "invited";
      else {
        const anon = createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const sent = await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
        delivery = sent.error ? "none" : "existing";
      }
    } catch {
      delivery = "none";
    }
    await audit(admin, "invite.resend", workspaceId, { inviteId, email, delivery });
    revalidatePath(`/admin/${workspaceId}`);
    return { ok: true, data: { email, delivery } };
  } catch (e) {
    await reportError("admin.resend_invite", e, { workspaceId });
    return fail(e instanceof Error ? e.message : String(e));
  }
}
