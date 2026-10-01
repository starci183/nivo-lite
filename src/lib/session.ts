import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { getLocale } from "@/i18n/server";
import { seedWorkspace } from "./seed";
import { ensureFlowDefaults } from "./flow-seed";
import { isManagerRole, type Member, type Role } from "./members-shared";
import type { Workspace } from "./types";

/** Cookie holding the workspace the person used last (only matters when they belong to several). */
export const WORKSPACE_COOKIE = "NIVO_WORKSPACE";

export type Session = {
  userId: string;
  /** The member's display name in this workspace (what Office and the decision history show). */
  userName: string;
  email: string;
  avatarUrl: string | null;
  workspace: Workspace;
  /** The signed-in person's identity in this workspace: role, linked staff row, display name. */
  member: Member;
};

type MemberRow = { workspace_id: string; user_id: string; role: Role; staff_id: string | null; display_name: string; status: "active" | "disabled" };

const toMember = (r: MemberRow): Member => ({
  userId: r.user_id, workspaceId: r.workspace_id, role: r.role, staffId: r.staff_id, displayName: r.display_name, status: r.status,
});

/**
 * The signed-in user with their active membership. When they belong to several workspaces the last-used one (cookie)
 * wins, else the oldest. Without any membership: a brand-new workspace only when NIVO_ALLOW_WORKSPACE_SIGNUP=1 (local
 * and demo), otherwise /workspaces (create a paid workspace or accept an invite). Disabled members land on /workspaces too.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  const fallbackName = meta.full_name || meta.name || user.email?.split("@")[0] || "Owner";

  const { data: rows } = await supabase.from("workspace_members").select("*").eq("user_id", user.id).order("created_at");
  const memberships = (rows ?? []) as Array<MemberRow>;
  const active = memberships.filter((m) => m.status === "active");

  let member: Member | null = null;
  let ws: Workspace | null = null;
  if (active.length) {
    const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
    member = toMember(active.find((m) => m.workspace_id === wanted) ?? active[0]);
    ws = ((await supabase.from("workspaces").select("*").eq("id", member.workspaceId).maybeSingle<Workspace>()).data) ?? null;
  } else if (memberships.length) {
    redirect("/workspaces?reason=disabled");
  } else if (process.env.NIVO_ALLOW_WORKSPACE_SIGNUP === "1") {
    // The insert trigger makes the creator the workspace's owner member.
    // Local/demo only: a free workspace (production creates workspaces through paid onboarding, server-side).
    const created = await supabaseAdmin().from("workspaces").insert({ owner_id: user.id, name: "NIVO Workspace", status: "active" }).select().single<Workspace>();
    if (created.error) throw new Error(created.error.message);
    ws = created.data;
    await seedWorkspace(supabase, ws.id, fallbackName, await getLocale());
    const mine = await supabase.from("workspace_members").select("*").eq("workspace_id", ws.id).eq("user_id", user.id).single<MemberRow>();
    if (mine.error) throw new Error(mine.error.message);
    member = toMember(mine.data);
  } else {
    redirect("/workspaces?reason=none");
  }
  if (!member || !ws) redirect("/workspaces?reason=none");
  // A workspace that is not paid yet (or cancelled) can't be used: send its people to the payment step.
  const status = (ws as Workspace & { status?: string }).status;
  if (status === "pending_payment" || status === "cancelled") redirect(`/workspaces/new/payment?ws=${ws.id}`);

  // Operating flow: authority + default rules (cheap check), and the simulated flow examples once per workspace.
  // Governance rows are writable by owner | manager only.
  if (isManagerRole(member.role)) await ensureFlowDefaults(supabase, ws.id, member.displayName, await getLocale());
  return { userId: user.id, userName: member.displayName, email: user.email ?? "", avatarUrl: meta.avatar_url ?? null, workspace: ws, member };
});
