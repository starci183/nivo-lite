import { Module } from "@nestjs/common"
import { WorkspacesApiModule } from "../../workspaces.module"
import { InvitesController } from "./invites.controller"
import { WorkspaceInvitesController } from "./workspace-invites.controller"
import { WorkspacesController } from "./workspaces.controller"

@Module({
    imports: [WorkspacesApiModule],
    controllers: [WorkspacesController, WorkspaceInvitesController, InvitesController],
})
/** The HTTP transport of the workspaces feature. */
export class WorkspacesHttpModule {}
