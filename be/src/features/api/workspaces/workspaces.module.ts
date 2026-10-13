import { Module } from "@nestjs/common"
import { AcceptInviteHandler } from "./application/accept-invite.handler"
import { ChangeMemberRoleHandler } from "./application/change-member-role.handler"
import { CopyInviteLinkHandler } from "./application/copy-invite-link.handler"
import { CreateInviteHandler } from "./application/create-invite.handler"
import { CreateWorkspaceHandler } from "./application/create-workspace.handler"
import { ListInvitesHandler } from "./application/list-invites.handler"
import { ListMembersHandler } from "./application/list-members.handler"
import { ListMembershipsHandler } from "./application/list-memberships.handler"
import { ListStaffHandler } from "./application/list-staff.handler"
import { PreviewInviteHandler } from "./application/preview-invite.handler"
import { RemoveMemberHandler } from "./application/remove-member.handler"
import { ResendInviteHandler } from "./application/resend-invite.handler"
import { RevokeInviteHandler } from "./application/revoke-invite.handler"
import { SaveStaffHandler } from "./application/save-staff.handler"
import { SetMemberStatusHandler } from "./application/set-member-status.handler"

@Module({
    providers: [
        AcceptInviteHandler,
        ChangeMemberRoleHandler,
        CopyInviteLinkHandler,
        CreateInviteHandler,
        CreateWorkspaceHandler,
        ListInvitesHandler,
        ListMembersHandler,
        ListMembershipsHandler,
        ListStaffHandler,
        PreviewInviteHandler,
        RemoveMemberHandler,
        ResendInviteHandler,
        RevokeInviteHandler,
        SaveStaffHandler,
        SetMemberStatusHandler,
    ],
})
/** The workspaces feature: the handlers of its application. */
export class WorkspacesApiModule {}
