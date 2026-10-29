import { WorkspaceMemberEntity } from "./workspace-member.entity"

export { WorkspaceMemberEntity }

/** Every entity the workspace-members capability owns, collected by the database connection. */
export const workspaceMembersEntities = [WorkspaceMemberEntity] as const
