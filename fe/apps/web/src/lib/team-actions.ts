"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { team } from "@/i18n/dict/team";
import { logEvidence } from "./core";
import { requireRole, type Role } from "./members";
import { supabaseServer } from "./supabase/server";
import type { Outcome } from "./types";

const ROLES: readonly Role[] = ["owner", "manager", "staff"];

const message = async (e: unknown): Promise<string> => {
  const t = await getT(team);
  const text = e instanceof Error ? e.message : String(e ?? "");
  if (text.includes("last_owner")) return t("errLastOwner");
  if (text.includes("row-level security") || text.includes("permission")) return t("errNotAllowed");
  // requireRole already throws a translated "forbidden" sentence.
  return e instanceof Error && !text.includes("violates") ? text : t("errGeneric");
};

type Target = { user_id: string; role: Role; status: string; display_name: string };

/** Load the member being changed; a manager may not touch an owner. */
const target = async (userId: string): Promise<{ me: Awaited<ReturnType<typeof requireRole>>; row: Target } | string> => {
  const t = await getT(team);
  const me = await requireRole(["owner", "manager"]);
  const db = await supabaseServer();
  const { data } = await db.from("workspace_members").select("user_id, role, status, display_name").eq("workspace_id", me.workspaceId).eq("user_id", userId).maybeSingle();
  if (!data) return t("errNotFound");
  const row = data as Target;
  if (row.role === "owner" && me.role !== "owner") return t("errNotAllowed");
  return { me, row };
};

/** Change someone's role. An owner can grant any role; a manager only manager | staff. The last active owner cannot be demoted. */
export async function changeMemberRole(userId: string, role: Role): Promise<Outcome<null>> {
  try {
    if (!ROLES.includes(role)) return { ok: false, error: (await getT(team))("errGeneric") };
    const found = await target(userId);
    if (typeof found === "string") return { ok: false, error: found };
    const { me, row } = found;
    if (role === "owner" && me.role !== "owner") return { ok: false, error: (await getT(team))("errNotAllowed") };
    if (row.role === role) return { ok: true, data: null };
    const db = await supabaseServer();
    const { data, error } = await db.from("workspace_members").update({ role }).eq("workspace_id", me.workspaceId).eq("user_id", userId).select("user_id");
    if (error) return { ok: false, error: await message(error) };
    if (!data?.length) return { ok: false, error: (await getT(team))("errNotAllowed") };
    await logEvidence(db, me.workspaceId, { kind: "member.role_changed", actor: me.displayName, summary: `${row.display_name}: ${row.role} → ${role}` });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: await message(e) };
  }
}

/** Disable (cannot sign in to this workspace) or enable a member. Not your own account. */
export async function setMemberStatus(userId: string, status: "active" | "disabled"): Promise<Outcome<null>> {
  try {
    const found = await target(userId);
    if (typeof found === "string") return { ok: false, error: found };
    const { me, row } = found;
    if (userId === me.userId) return { ok: false, error: (await getT(team))("errSelf") };
    const db = await supabaseServer();
    const { data, error } = await db.from("workspace_members").update({ status }).eq("workspace_id", me.workspaceId).eq("user_id", userId).select("user_id");
    if (error) return { ok: false, error: await message(error) };
    if (!data?.length) return { ok: false, error: (await getT(team))("errNotAllowed") };
    await logEvidence(db, me.workspaceId, { kind: status === "disabled" ? "member.disabled" : "member.enabled", actor: me.displayName, summary: row.display_name });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: await message(e) };
  }
}

/** Remove a member from the workspace (their account and past work stay). Not your own account. */
export async function removeMember(userId: string): Promise<Outcome<null>> {
  try {
    const found = await target(userId);
    if (typeof found === "string") return { ok: false, error: found };
    const { me, row } = found;
    if (userId === me.userId) return { ok: false, error: (await getT(team))("errSelf") };
    const db = await supabaseServer();
    const { data, error } = await db.from("workspace_members").delete().eq("workspace_id", me.workspaceId).eq("user_id", userId).select("user_id");
    if (error) return { ok: false, error: await message(error) };
    if (!data?.length) return { ok: false, error: (await getT(team))("errNotAllowed") };
    await logEvidence(db, me.workspaceId, { kind: "member.removed", actor: me.displayName, summary: row.display_name });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: await message(e) };
  }
}
