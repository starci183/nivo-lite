import { Module } from "@nestjs/common"
import { AdminApiModule } from "../../admin.module"
import { GetAdminSessionController } from "./get-admin-session.controller"
import { ListWorkspacesController } from "./list-workspaces.controller"
import { GetWorkspaceDetailController } from "./get-workspace-detail.controller"
import { GetPlatformHealthController } from "./get-platform-health.controller"
import { ExtendSubscriptionController } from "./extend-subscription.controller"
import { SetWorkspaceStatusController } from "./set-workspace-status.controller"
import { SetWorkspacePlanController } from "./set-workspace-plan.controller"
import { ResendWorkspaceInviteController } from "./resend-workspace-invite.controller"

@Module({
    imports: [AdminApiModule],
    controllers: [
        GetAdminSessionController,
        ListWorkspacesController,
        GetWorkspaceDetailController,
        GetPlatformHealthController,
        ExtendSubscriptionController,
        SetWorkspaceStatusController,
        SetWorkspacePlanController,
        ResendWorkspaceInviteController,
    ],
})
/** The HTTP transport of the admin feature. */
export class AdminHttpModule {}
