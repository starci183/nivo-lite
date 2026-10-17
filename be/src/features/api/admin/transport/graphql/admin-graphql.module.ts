import { Module } from "@nestjs/common"
import { AdminApiModule } from "../../admin.module"
import { ConfigurableModuleClass } from "./admin-graphql.module-definition"
import { AdminSessionResolver } from "./admin-session.resolver"
import { AdminWorkspacesResolver } from "./admin-workspaces.resolver"
import { AdminWorkspaceResolver } from "./admin-workspace.resolver"
import { AdminHealthResolver } from "./admin-health.resolver"
import { AdminExtendSubscriptionResolver } from "./admin-extend-subscription.resolver"
import { AdminSetWorkspaceStatusResolver } from "./admin-set-workspace-status.resolver"
import { AdminSetWorkspacePlanResolver } from "./admin-set-workspace-plan.resolver"
import { AdminResendWorkspaceInviteResolver } from "./admin-resend-workspace-invite.resolver"

@Module({
    imports: [AdminApiModule.register({})],
    providers: [
        AdminSessionResolver,
        AdminWorkspacesResolver,
        AdminWorkspaceResolver,
        AdminHealthResolver,
        AdminExtendSubscriptionResolver,
        AdminSetWorkspaceStatusResolver,
        AdminSetWorkspacePlanResolver,
        AdminResendWorkspaceInviteResolver,
    ],
})
/** The GraphQL transport of the admin feature. */
export class AdminGraphqlModule extends ConfigurableModuleClass {}
