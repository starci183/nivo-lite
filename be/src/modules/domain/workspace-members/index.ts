// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { WorkspaceMembersReadService } from "./workspace-members-read.service"
export type { MemberName, MemberRow, MemberSeat } from "./workspace-members-read.contracts"
export { WORKSPACE_MEMBERS_ERROR_KINDS } from "./errors/workspace-members.error"
export { WORKSPACE_MEMBERS_MESSAGES } from "./messages/workspace-members.messages"
export { canDecide, isManagerRole, PresentedRole } from "./role.policy"
export type {
    AccountDirectory,
    AccountOverview,
    MemberListing,
    StaffOption,
    WorkspaceMember,
    WorkspaceRole,
} from "./workspace-members.contracts"
export { ACCOUNT_DIRECTORY, InjectAccountDirectory } from "./workspace-members.port"
export { WorkspaceId } from "./workspace-members.decorators"
export { WorkspaceMembersModule } from "./workspace-members.module"
export { AccountSessionsService } from "./account-sessions.service"
export { WorkspaceMembersService } from "./workspace-members.service"
export { WorkspaceMemberDirectoryService } from "./workspace-member-directory.service"
export type { DirectoryMember } from "./workspace-member-directory.contracts"
export { MemberLookupService } from "./member-lookup.service"
export type { MemberRef, OwnerMemberRef } from "./member-lookup.contracts"
export { WorkspaceMemberEntity, workspaceMembersEntities } from "./persistence/entities"
export { MemberRosterService } from "./member-roster.service"
