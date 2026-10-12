import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { reportError } from "./errors";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";

/**
 * Platform admins (the NIVO team): the emails in NIVO_PLATFORM_ADMINS (comma list), checked server-side on every request.
 * Anyone else, signed in or not, gets a 404 so the console is not even discoverable. Data is read with the service-role
 * client in server components / actions only; every view and action is written to platform_audit.
 */
export type PlatformAdmin = { readonly userId: string; readonly email: string };

const adminList = (): ReadonlyArray<string> =>
  (process.env.NIVO_PLATFORM_ADMINS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** The signed-in platform admin, or null. */
export const currentPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const list = adminList();
  if (list.length === 0) return null;
  const { data } = await (await supabaseServer()).auth.getUser();
  const email = data.user?.email?.trim().toLowerCase();
  return data.user && email && list.includes(email) ? { userId: data.user.id, email } : null;
});

/** Every /admin page and action starts here: a non-admin never gets past a 404. */
export const requirePlatformAdmin = async (): Promise<PlatformAdmin> => {
  const admin = await currentPlatformAdmin();
  if (!admin) notFound();
  return admin;
};

/** Writes one platform_audit row. Never throws (a broken audit table must not take the console down, but it is reported). */
export const audit = async (admin: PlatformAdmin, action: string, workspaceId: string | null, data: Record<string, unknown> = {}): Promise<void> => {
  try {
    const { error } = await supabaseAdmin().from("platform_audit").insert({ actor_email: admin.email, actor_id: admin.userId, action, workspace_id: workspaceId, data });
    if (error) throw new Error(error.message);
  } catch (e) {
    await reportError("admin.audit", e, { workspaceId, action });
  }
};
