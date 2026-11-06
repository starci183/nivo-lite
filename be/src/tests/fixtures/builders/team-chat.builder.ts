import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import type { EntityManager } from "typeorm"
import { agentsEntities } from "@modules/domain/agents"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities
const [AgentEntity] = agentsEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities
const [ApprovalRequestEntity] = approvalRequestsEntities

/** The people of one team chat proof: an owner, three staff and a person of another workspace. */
export interface TeamChatIdentity {
    /** The workspace. */
    readonly workspaceId: string
    /** The owner of the workspace. */
    readonly ownerId: string
    /** Three staff seats. */
    readonly staffIds: readonly [string, string, string]
    /** An active agent of the workspace. */
    readonly agentId: string
    /** An account that sits in a different workspace. */
    readonly outsiderId: string
    /** The workspace of the outsider. */
    readonly foreignWorkspaceId: string
}

/** Fresh ids for a proof. */
export const teamChatIdentity = (id: () => string): TeamChatIdentity => ({
    workspaceId: id(),
    ownerId: id(),
    staffIds: [id(), id(), id()],
    agentId: id(),
    outsiderId: id(),
    foreignWorkspaceId: id(),
})

/** Writes the accounts and the two workspaces (the owner seat is the database's), then the staff seats. */
export const persistTeamChat = (manager: EntityManager, identity: TeamChatIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        for (const userId of [identity.ownerId, ...identity.staffIds, identity.outsiderId]) {
            await tx.insert("auth.users", { id: userId, raw_user_meta_data: {} })
        }
        await tx.insert(WorkspaceEntity, { id: identity.workspaceId, ownerId: identity.ownerId, name: "Team chat proof" })
        await tx.insert(WorkspaceEntity, {
            id: identity.foreignWorkspaceId,
            ownerId: identity.outsiderId,
            name: "Foreign team chat proof",
        })
        await tx.update(WorkspaceMemberEntity, { workspaceId: identity.workspaceId, userId: identity.ownerId }, { displayName: "Owner" })
        await tx.insert(AgentEntity, {
            id: identity.agentId,
            workspaceId: identity.workspaceId,
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "",
            knowledge: "",
            greeting: "",
            approvalRule: "",
            status: "active",
        })
        await tx.insert(
            WorkspaceMemberEntity,
            identity.staffIds.map((userId, index) => ({
                workspaceId: identity.workspaceId,
                userId,
                role: "staff" as const,
                displayName: `Staff ${String(index + 1)}`,
                status: "active" as const,
            })),
        )
    })

/** The ids a spec says for one approval request it opens. */
export interface ApprovalRequestIds {
    id: string
    chainStepId: string
}

/** Opens a pending approval request of the workspace under the given ids, asked for by its agent: the decision a card is about. */
export const persistApprovalRequest = async (
    manager: EntityManager,
    identity: TeamChatIdentity,
    ids: ApprovalRequestIds,
): Promise<string> => {
    await manager.insert(ApprovalRequestEntity, {
        ...ids,
        workspaceId: identity.workspaceId,
        department: "sales",
        action: "refund",
        unit: "vnd",
        policy: "any",
        requestedByAgentId: identity.agentId,
        timeoutMinutes: 30,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    })
    return ids.id
}
