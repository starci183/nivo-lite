import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { AgentOwners, OwnerCard } from "./agents.contracts"
import type { AssignContext, MemberState, TagContext } from "./agents-reads.contracts"
import type { AgentEntity } from "./persistence/entities"

/** The workspace roles an agent can be assigned to, in the order the page shows them. */
export const ASSIGNABLE_ROLES: ReadonlyArray<WorkspaceRole> = ["owner", "manager", "staff"]

/** The keys of the department rooms (the Hub rooms table accepts exactly these). */
export const ROOM_KEYS: ReadonlyArray<string> = ["executive", "frontdesk", "sales", "marketing", "care", "accounting"]

const ROLE_NAMES: ReadonlySet<string> = new Set(ASSIGNABLE_ROLES)

/** Whether a text names a workspace role an agent can be assigned by. */
export const isAssignableRole = (value: string): boolean => ROLE_NAMES.has(value)

/** The stored roles that are real workspace roles, in the order the page shows them. */
export const rolesOf = (stored: ReadonlyArray<string>): ReadonlyArray<WorkspaceRole> =>
    ASSIGNABLE_ROLES.filter((role) => stored.includes(role))

/**
 * Who answers for an agent now. The stored owner answers while they are an active member; when they left or were disabled the
 * stored fallback answers; when that one is gone too the workspace owner answers. The person after the responder is the next
 * candidate of the same chain, so a rejected or expired item always has somebody to go to. Null when no one in the chain is
 * active (a workspace without an active owner).
 */
export const resolveOwners = (
    agent: Pick<AgentEntity, "ownerMemberId" | "fallbackMemberId">,
    activeIds: ReadonlySet<string>,
    workspaceOwnerId: string | null,
): AgentOwners | null => {
    const stored = [agent.ownerMemberId, agent.fallbackMemberId].filter(
        (id): id is string => id !== null && activeIds.has(id),
    )
    const chain = [...new Set([...stored, ...(workspaceOwnerId === null ? [] : [workspaceOwnerId])])]
    const [ownerMemberId, fallbackMemberId] = chain
    return ownerMemberId === undefined ? null : { ownerMemberId, fallbackMemberId: fallbackMemberId ?? null }
}

/**
 * Whether a member may hand an agent work: both are live (an active member, an active agent) and the member qualifies by their
 * role or by a seat in one of the rooms the agent is open to. A room the agent no longer lists, or a seat the member lost,
 * gives nothing.
 */
export const mayAssign = (context: AssignContext): boolean => {
    if (context.memberStatus !== "active" || context.agentStatus !== "active") return false
    return (
        context.assignableRoles.includes(context.role) ||
        context.memberRooms.some((room) => context.assignableRooms.includes(room))
    )
}

/** Whether an agent may pass work to another: two different active agents of one workspace, the second on the first's list. */
export const mayTag = (context: TagContext): boolean =>
    !context.sameAgent &&
    context.sameWorkspace &&
    context.listed &&
    context.fromStatus === "active" &&
    context.toStatus === "active"

/** A member row as the card the page shows. */
export const ownerCardOf = (row: MemberState): OwnerCard => ({
    memberId: row.id,
    name: row.displayName,
    role: row.role,
    roomId: row.roomKey,
    active: row.status === "active",
})
