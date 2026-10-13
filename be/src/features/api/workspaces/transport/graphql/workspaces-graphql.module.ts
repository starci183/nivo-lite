import { Module } from "@nestjs/common"
import { WorkspacesApiModule } from "../../workspaces.module"
import { AcceptInviteResolver } from "./accept-invite.resolver"
import { ChangeMemberRoleResolver } from "./change-member-role.resolver"
import { CopyInviteLinkResolver } from "./copy-invite-link.resolver"
import { CreateInviteResolver } from "./create-invite.resolver"
import { CreateWorkspaceResolver } from "./create-workspace.resolver"
import { InvitePreviewResolver } from "./invite-preview.resolver"
import { MembershipsResolver } from "./memberships.resolver"
import { RemoveMemberResolver } from "./remove-member.resolver"
import { ResendInviteResolver } from "./resend-invite.resolver"
import { RevokeInviteResolver } from "./revoke-invite.resolver"
import { SaveStaffResolver } from "./save-staff.resolver"
import { SetMemberStatusResolver } from "./set-member-status.resolver"
import { WorkspaceInvitesResolver } from "./workspace-invites.resolver"
import { WorkspaceMembersResolver } from "./workspace-members.resolver"
import { WorkspaceStaffResolver } from "./workspace-staff.resolver"

@Module({
    imports: [WorkspacesApiModule],
    providers: [
        MembershipsResolver,
        CreateWorkspaceResolver,
        WorkspaceMembersResolver,
        WorkspaceInvitesResolver,
        WorkspaceStaffResolver,
        InvitePreviewResolver,
        CreateInviteResolver,
        ResendInviteResolver,
        CopyInviteLinkResolver,
        RevokeInviteResolver,
        AcceptInviteResolver,
        ChangeMemberRoleResolver,
        SaveStaffResolver,
        SetMemberStatusResolver,
        RemoveMemberResolver,
    ],
})
/** The GraphQL transport of the workspaces feature. */
export class WorkspacesGraphqlModule {}
