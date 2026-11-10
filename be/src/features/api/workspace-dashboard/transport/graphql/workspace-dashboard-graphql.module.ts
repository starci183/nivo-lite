import { Module } from "@nestjs/common"
import { WorkspaceDashboardApiModule } from "../../workspace-dashboard.module"
import { WorkspaceDashboardResolver } from "./workspace-dashboard.resolver"
import { ConfigurableModuleClass } from "./workspace-dashboard-graphql.module-definition"

@Module({ imports: [WorkspaceDashboardApiModule.register({})], providers: [WorkspaceDashboardResolver] })
/** The GraphQL transport of the owner business dashboard. */
export class WorkspaceDashboardGraphqlModule extends ConfigurableModuleClass {}
