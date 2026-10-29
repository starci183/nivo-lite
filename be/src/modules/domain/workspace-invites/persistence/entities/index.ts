import { WorkspaceInviteEntity } from "./workspace-invite.entity"

export { WorkspaceInviteEntity } from "./workspace-invite.entity"
export type { WorkspaceInviteRole } from "./workspace-invite.entity"

/** Every entity of the workspace-invites capability. */
export const workspaceInvitesEntities = [WorkspaceInviteEntity] as const
