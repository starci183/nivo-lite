import { Module } from "@nestjs/common"
import { WorkspacesApiModule } from "../../workspaces.module"
import { CreateWorkspaceResolver } from "./create-workspace.resolver"
import { MembershipsResolver } from "./memberships.resolver"

@Module({
    imports: [WorkspacesApiModule],
    providers: [MembershipsResolver, CreateWorkspaceResolver],
})
/** The GraphQL transport of the workspaces feature. */
export class WorkspacesGraphqlModule {}
