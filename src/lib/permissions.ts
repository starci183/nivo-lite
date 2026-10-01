import "server-only";
import { translator, type Locale } from "@/i18n/core";
import { access } from "@/i18n/dict/access";
import { canDecide, getCurrentMember, requireRole, type Member } from "./members";
import type { Decider } from "./engine";
import type { WorkItem } from "./flow-types";

/** Owner or manager, else a friendly translated error (authority, rules, staff and agent edits). */
export const requireManager = (): Promise<Member> => requireRole(["owner", "manager"]);

/** Who a decision is recorded as: the real member's name; staff accounts are `staff`, owner and manager are `owner`. */
export const deciderOf = (member: Member): Decider => ({ name: member.displayName, kind: member.role === "staff" ? "staff" : "owner" });

/** The signed-in member, if they may decide `item` (owner, manager, or the staff member it is assigned to); otherwise a friendly error. */
export const requireDecide = async (item: Pick<WorkItem, "assigned_staff_id">, locale: Locale): Promise<Member> => {
  const member = await getCurrentMember();
  if (!canDecide(member, { assignee_kind: item.assigned_staff_id ? "staff" : null, assignee_id: item.assigned_staff_id })) {
    throw new Error((translator(access, locale))("forbiddenDecide"));
  }
  return member;
};
