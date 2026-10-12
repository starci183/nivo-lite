"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";
import { setWorkspaceCookie } from "./billing";
import type { Outcome } from "./types";

/** An invitation addressed to the signed-in person's email (shown on /onboarding path B: join for free). */
export type MyInvite = { id: string; workspaceName: string; role: "manager" | "staff"; invitedBy: string | null; expiresAt: string };

const signedIn = async () => {
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user;
};

type InviteRow = { id: string; workspace_id: string; role: "manager" | "staff"; staff_id: string | null; invited_by: string | null; expires_at: string };

const openInvites = async (email: string): Promise<Array<InviteRow>> => {
  const { data } = await supabaseAdmin()
    .from("workspace_invites")
    .select("id, workspace_id, role, staff_id, invited_by, expires_at")
    .ilike("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []) as Array<InviteRow>;
};

/** Pending invitations for the signed-in user's email (RLS hides them from the user, so this reads with the service role). */
export const listMyInvites = async (): Promise<Array<MyInvite>> => {
  const user = await signedIn();
  if (!user?.email) return [];
  const rows = await openInvites(user.email);
  if (!rows.length) return [];
  const admin = supabaseAdmin();
  const { data: wss } = await admin.from("workspaces").select("id, name").in("id", rows.map((r) => r.workspace_id));
  const names = new Map((wss ?? []).map((w: { id: string; name: string }) => [w.id, w.name]));
  const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter((x): x is string => !!x))];
  const inviters = new Map<string, string>();
  if (inviterIds.length) {
    const { data: ms } = await admin.from("workspace_members").select("user_id, workspace_id, display_name").in("user_id", inviterIds);
    for (const m of (ms ?? []) as Array<{ user_id: string; display_name: string }>) if (!inviters.has(m.user_id)) inviters.set(m.user_id, m.display_name);
  }
  return rows.map((r) => ({
    id: r.id,
    workspaceName: names.get(r.workspace_id) ?? "",
    role: r.role,
    invitedBy: r.invited_by ? (inviters.get(r.invited_by) ?? null) : null,
    expiresAt: r.expires_at,
  }));
};

/**
 * Join a workspace from its invitation without the link: allowed only when the invite is addressed to the signed-in user's
 * email and is still open. Mirrors A1's `accept_invite(token)` (membership upsert + invite marked accepted).
 */
export const acceptInviteForMe = async (inviteId: string): Promise<Outcome<{ workspaceId: string }>> => {
  const user = await signedIn();
  if (!user?.email) return { ok: false, error: "not_signed_in" };
  const invite = (await openInvites(user.email)).find((i) => i.id === inviteId);
  if (!invite) return { ok: false, error: "invite_invalid" };
  const admin = supabaseAdmin();
  let displayName: string | null = null;
  if (invite.staff_id) displayName = ((await admin.from("staff").select("name").eq("id", invite.staff_id).maybeSingle()).data as { name: string } | null)?.name ?? null;
  const meta = user.user_metadata as { full_name?: string; name?: string };
  displayName ||= meta.full_name || meta.name || user.email.split("@")[0];
  const existing = (await admin.from("workspace_members").select("role").eq("workspace_id", invite.workspace_id).eq("user_id", user.id).maybeSingle()).data as { role: string } | null;
  const up = await admin.from("workspace_members").upsert(
    {
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: existing?.role === "owner" ? "owner" : invite.role,
      staff_id: invite.staff_id,
      display_name: displayName,
      status: "active",
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (up.error) return { ok: false, error: up.error.message };
  await admin.from("workspace_invites").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", invite.id);
  await setWorkspaceCookie(invite.workspace_id);
  revalidatePath("/", "layout");
  return { ok: true, data: { workspaceId: invite.workspace_id } };
};
