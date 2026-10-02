import "server-only";
import { cache } from "react";
import { getT } from "@/i18n/server";
import { access } from "@/i18n/dict/access";
import { canDecide, isManagerRole, type Member, type Role } from "./members-shared";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export { canDecide, isManagerRole };
export type { Member, Role };

export type MemberListing = Member & { email: string; lastSignInAt: string | null };

/** The signed-in person's active membership in the current workspace (redirects to /login when signed out). */
export const getCurrentMember = async (): Promise<Member> => (await getSession()).member;

/** The current member when their role is one of `roles`; otherwise throws a friendly, translated error. */
export const requireRole = async (roles: Role[]): Promise<Member> => {
  const member = await getCurrentMember();
  if (!roles.includes(member.role)) throw new Error((await getT(access))("forbidden"));
  return member;
};

/** Everyone in the current workspace, owners first. Emails are blank for staff viewers. */
export const listMembers = cache(async (): Promise<Array<MemberListing>> => {
  const session = await getSession();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("workspace_members_directory", { ws: session.workspace.id });
  if (error) throw new Error(error.message);
  type Row = { user_id: string; role: Role; staff_id: string | null; display_name: string; status: "active" | "disabled"; email: string | null; last_sign_in_at: string | null };
  return ((data ?? []) as Array<Row>).map((r) => ({
    userId: r.user_id, workspaceId: session.workspace.id, role: r.role, staffId: r.staff_id, displayName: r.display_name,
    status: r.status, email: r.email ?? "", lastSignInAt: r.last_sign_in_at,
  }));
});
