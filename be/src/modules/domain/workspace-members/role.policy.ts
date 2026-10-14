import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { DecisionItem, SeatPair, SeatRule, WorkspaceMember, WorkspaceRole } from "./workspace-members.contracts"

/** The role a member holds, as the console names it. */
export enum PresentedRole {
    /** Grants full control of the workspace. */
    Owner = "owner",
    /** Grants setup and agent administration. */
    Manager = "manager",
    /** Grants day-to-day use without administration. */
    Staff = "staff",
}

const PRESENTED: Readonly<Record<WorkspaceRole, PresentedRole>> = {
    owner: PresentedRole.Owner,
    manager: PresentedRole.Manager,
    staff: PresentedRole.Staff,
}

/** The console name of a membership role. */
export const presentedRole = (role: WorkspaceRole): PresentedRole => PRESENTED[role]

/** True for owner and manager. */
export const isManagerRole = (role: WorkspaceRole): boolean => role === "owner" || role === "manager"

/**
 * Admits an active member, and when `roles` is not empty only one holding one of them. A disabled member and a member
 * whose role is too low get different refusals.
 */
export const admitMember = (
    member: WorkspaceMember,
    roles: ReadonlyArray<WorkspaceRole>,
): Outcome<WorkspaceMember, WorkspaceMembersErrorCode> => {
    if (member.status !== "active") return refused(WorkspaceMembersErrorCode.NotMember)
    if (roles.length > 0 && !roles.includes(member.role)) return refused(WorkspaceMembersErrorCode.RoleForbidden)
    return ok(member)
}

/**
 * Whether `member` may decide a work item. Owner and manager decide anything; staff decide only items assigned to
 * them (`assigneeId` is the assigned staff id; an unassigned item is not theirs).
 */
export const canDecide = (member: WorkspaceMember, item: DecisionItem): boolean => {
    if (member.status !== "active") return false
    if (isManagerRole(member.role)) return true
    if (item.assigneeKind && item.assigneeKind !== "staff") return false
    return member.staffId !== null && item.assigneeId === member.staffId
}

/**
 * Whether an owner or manager may change another member's seat: only they act, never on oneself for access, an owner
 * row and the owner role are for owners.
 */
export const judgeSeatChange = (pair: SeatPair, rule: SeatRule): Outcome<true, WorkspaceMembersErrorCode> => {
    if (!isManagerRole(pair.actor.role)) return refused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    if (rule.forbidSelf && pair.actor.userId === pair.target.userId) {
        return refused(WorkspaceMembersErrorCode.SelfForbidden)
    }
    if (pair.target.role === "owner" && pair.actor.role !== "owner") {
        return refused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    }
    if (rule.nextRole === "owner" && pair.actor.role !== "owner") {
        return refused(WorkspaceMembersErrorCode.ChangeNotAllowed)
    }
    return ok(true)
}
