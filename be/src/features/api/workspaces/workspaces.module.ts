import { Module } from "@nestjs/common"
import { AcceptInviteHandler } from "./application/accept-invite.handler"
import { CopyInviteLinkHandler } from "./application/copy-invite-link.handler"
import { CreateInviteHandler } from "./application/create-invite.handler"
import { CreateWorkspaceHandler } from "./application/create-workspace.handler"
import { ListInvitesHandler } from "./application/list-invites.handler"
import { ListMembersHandler } from "./application/list-members.handler"
import { ListMembershipsHandler } from "./application/list-memberships.handler"
import { PreviewInviteHandler } from "./application/preview-invite.handler"
import { ResendInviteHandler } from "./application/resend-invite.handler"
import { RevokeInviteHandler } from "./application/revoke-invite.handler"

@Module({
    providers: [
        AcceptInviteHandler,
        CopyInviteLinkHandler,
        CreateInviteHandler,
        CreateWorkspaceHandler,
        ListInvitesHandler,
        ListMembersHandler,
        ListMembershipsHandler,
        PreviewInviteHandler,
        ResendInviteHandler,
        RevokeInviteHandler,
    ],
})
/** The workspaces feature: the handlers of its application. */
export class WorkspacesApiModule {}
