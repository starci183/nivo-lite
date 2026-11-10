import { Module } from "@nestjs/common"
import { SchedulesApiModule } from "../../schedules.module"
import { ConfigurableModuleClass } from "./schedules-graphql.module-definition"
import { ScheduledItemsResolver } from "./scheduled-items.resolver"

@Module({
    imports: [SchedulesApiModule.register({})],
    providers: [ScheduledItemsResolver],
})
/** The GraphQL transport of the schedules feature. */
export class SchedulesGraphqlModule extends ConfigurableModuleClass {}
