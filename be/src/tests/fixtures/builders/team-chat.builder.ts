import type { EntityManager } from "typeorm"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

/** The people of one team chat proof: an owner, three staff and a person of another workspace. */
export interface TeamChatIdentity {
    /** The workspace. */
    readonly workspaceId: string
    /** The owner of the workspace. */
    readonly ownerId: string
    /** Three staff seats. */
    readonly staffIds: readonly [string, string, string]
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
