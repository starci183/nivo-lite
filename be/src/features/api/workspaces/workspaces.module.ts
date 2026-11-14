import { Module } from "@nestjs/common"
import { AcceptInviteHandler } from "./application/accept-invite.handler"
import { ChangeMemberRoleHandler } from "./application/change-member-role.handler"
import { CopyInviteLinkHandler } from "./application/copy-invite-link.handler"
import { CreateInviteHandler } from "./application/create-invite.handler"
import { CreateWorkspaceHandler } from "./application/create-workspace.handler"
import { StartFirstWorkspaceHandler } from "./application/start-first-workspace.handler"
import { ListInvitesHandler } from "./application/list-invites.handler"
import { ListMembersHandler } from "./application/list-members.handler"
import { ListMembershipsHandler } from "./application/list-memberships.handler"
import { MyWorkspaceRoleHandler } from "./application/my-workspace-role.handler"
import { ListStaffHandler } from "./application/list-staff.handler"
import { PreviewInviteHandler } from "./application/preview-invite.handler"
import { RemoveMemberHandler } from "./application/remove-member.handler"
import { ResendInviteHandler } from "./application/resend-invite.handler"
import { RevokeInviteHandler } from "./application/revoke-invite.handler"
import { SaveStaffHandler } from "./application/save-staff.handler"
import { SetMemberStatusHandler } from "./application/set-member-status.handler"
import { DeclineInviteHandler } from "./application/decline-invite.handler"
import { DeleteWorkspaceHandler } from "./application/delete-workspace.handler"
import { JoinInviteHandler } from "./application/join-invite.handler"
import { LeaveWorkspaceHandler } from "./application/leave-workspace.handler"
import { ListMyInvitesHandler } from "./application/list-my-invites.handler"
import { RenameWorkspaceHandler } from "./application/rename-workspace.handler"
import { ListDeclinedInvitesHandler } from "./application/list-declined-invites.handler"
import { MyWorkInHandHandler } from "./application/my-work-in-hand.handler"
import { RestoreWorkspaceHandler } from "./application/restore-workspace.handler"
import { ReadWorkspaceSettingsHandler } from "./application/read-workspace-settings.handler"
import { RequestWorkspaceLogoUploadHandler } from "./application/request-workspace-logo-upload.handler"
import { UpdateWorkspaceSettingsHandler } from "./application/update-workspace-settings.handler"
import { ConfigurableModuleClass } from "./workspaces.module-definition"

@Module({
    providers: [
        AcceptInviteHandler,
        ChangeMemberRoleHandler,
        CopyInviteLinkHandler,
        CreateInviteHandler,
        CreateWorkspaceHandler,
        StartFirstWorkspaceHandler,
        ListInvitesHandler,
        ListMembersHandler,
        ListMembershipsHandler,
        MyWorkspaceRoleHandler,
        ListStaffHandler,
        PreviewInviteHandler,
        RemoveMemberHandler,
        ResendInviteHandler,
        RevokeInviteHandler,
        SaveStaffHandler,
        SetMemberStatusHandler,
        DeclineInviteHandler,
        DeleteWorkspaceHandler,
        JoinInviteHandler,
        LeaveWorkspaceHandler,
        ListMyInvitesHandler,
        RenameWorkspaceHandler,
        ListDeclinedInvitesHandler,
        MyWorkInHandHandler,
        RestoreWorkspaceHandler,
        ReadWorkspaceSettingsHandler,
        UpdateWorkspaceSettingsHandler,
        RequestWorkspaceLogoUploadHandler,
    ],
})
/** The workspaces feature: the handlers of its application. */
export class WorkspacesApiModule extends ConfigurableModuleClass {}
