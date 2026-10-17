import { Module } from "@nestjs/common"
import { OverviewApiModule } from "../../overview.module"
import { DashboardResolver } from "./dashboard.resolver"
import { ConfigurableModuleClass } from "./overview-graphql.module-definition"

@Module({
    imports: [OverviewApiModule.register({})],
    providers: [DashboardResolver],
})
/** The GraphQL transport of the overview feature. */
export class OverviewGraphqlModule extends ConfigurableModuleClass {}
