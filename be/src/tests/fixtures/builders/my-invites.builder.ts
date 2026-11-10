import { workspaceInvitesEntities } from "@modules/domain/workspace-invites"
import { entityOf } from "./entity.builder"

const WorkspaceInviteEntity: (typeof workspaceInvitesEntities)[0] = workspaceInvitesEntities[0]

/** A stored invitation row. */
type InviteRow = InstanceType<typeof WorkspaceInviteEntity>

/** A pending invitation of `ws-1` to an@example.test, sent by `owner-1`; each override changes one fact of it. */
export const myInviteRow: (overrides?: Partial<InviteRow>) => InviteRow = entityOf(WorkspaceInviteEntity, {
    id: "invite-1",
    workspaceId: "ws-1",
    email: "an@example.test",
    role: "staff",
    staffId: null,
    invitedBy: "owner-1",
    expiresAt: new Date("2026-11-15T08:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
})

/** The pending invitations one person holds: the default, one with no known sender, one whose workspace is gone. */
export const MY_INVITE_ROWS: ReadonlyArray<InviteRow> = [
    myInviteRow(),
    myInviteRow({ id: "invite-2", invitedBy: null }),
    myInviteRow({ id: "invite-3", workspaceId: "ws-gone" }),
]

/** The invitation an@example.test declined. */
export const DECLINED_INVITE_ROW: InviteRow = myInviteRow({ declinedAt: new Date("2026-11-08T08:00:00.000Z") })
