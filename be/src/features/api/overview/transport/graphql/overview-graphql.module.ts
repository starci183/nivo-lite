import { Module } from "@nestjs/common"
import { OverviewApiModule } from "../../overview.module"
import { DashboardResolver } from "./dashboard.resolver"

@Module({
    imports: [OverviewApiModule],
    providers: [DashboardResolver],
})
/** The GraphQL transport of the overview feature. */
export class OverviewGraphqlModule {}
