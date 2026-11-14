import type { LobbySeat } from "@modules/domain/workspace-members"
import { RESTORE_DAYS, type WorkspaceMembership } from "./workspaces.contracts"
import type { WorkspaceEntity } from "./persistence/entities"

const DAY_MS = 86_400_000

/** The active members and owners of a workspace. */
interface PeopleCount {
    readonly count: number
    readonly owners: number
}

/** The last day the owner may restore a workspace deleted at `deletedAt`. */
const restoreBeforeOf = (deletedAt: Date): string => new Date(deletedAt.getTime() + RESTORE_DAYS * DAY_MS).toISOString()

/** One seat of the person with its workspace and the lobby facts of both. */
export const toLobbyMembership = (
    seat: LobbySeat,
    workspace: WorkspaceEntity,
    people: PeopleCount | undefined,
): WorkspaceMembership => {
    const { lastOpenedAt, disabledAt, disabledBy, disabledNote, disabledByDeletion, ...member } = seat
    const isOffByPerson = member.status === "disabled" && !disabledByDeletion
    return {
        member,
        workspace: {
            id: workspace.id,
            name: workspace.name,
            status: workspace.status,
            ownerId: workspace.ownerId,
            createdAt: workspace.createdAt.toISOString(),
            businessType: workspace.businessType,
        },
        lobby: {
            planCode: workspace.planCode,
            seatCount: workspace.seatCount,
            memberCount: people?.count ?? 0,
            ownerCount: people?.owners ?? 0,
            lastOpenedAt,
            deletedAt: workspace.deletedAt === null ? null : workspace.deletedAt.toISOString(),
            restoreBefore: workspace.deletedAt === null ? null : restoreBeforeOf(workspace.deletedAt),
            disabledAt: isOffByPerson ? disabledAt : null,
            disabledByName: isOffByPerson ? (disabledBy?.displayName ?? null) : null,
            disabledByRole: isOffByPerson ? (disabledBy?.role ?? null) : null,
            disabledNote: isOffByPerson ? disabledNote : null,
        },
    }
}
