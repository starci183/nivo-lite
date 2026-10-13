import { Module } from "@nestjs/common"
import { GetAdminSessionHandler } from "./application/get-admin-session.handler"
import { ListWorkspacesHandler } from "./application/list-workspaces.handler"
import { GetWorkspaceDetailHandler } from "./application/get-workspace-detail.handler"
import { GetPlatformHealthHandler } from "./application/get-platform-health.handler"
import { ExtendSubscriptionHandler } from "./application/extend-subscription.handler"
import { SetWorkspaceStatusHandler } from "./application/set-workspace-status.handler"
import { SetWorkspacePlanHandler } from "./application/set-workspace-plan.handler"
import { ResendWorkspaceInviteHandler } from "./application/resend-workspace-invite.handler"

@Module({
    providers: [
        GetAdminSessionHandler,
        ListWorkspacesHandler,
        GetWorkspaceDetailHandler,
        GetPlatformHealthHandler,
        ExtendSubscriptionHandler,
        SetWorkspaceStatusHandler,
        SetWorkspacePlanHandler,
        ResendWorkspaceInviteHandler,
    ],
})
/** The admin feature: the handlers of its application. */
export class AdminApiModule {}
