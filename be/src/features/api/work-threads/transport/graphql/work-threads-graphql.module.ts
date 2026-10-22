import { Module } from "@nestjs/common"
import { WorkThreadsApiModule } from "../../work-threads.module"
import { WorkThreadCommandsResolver } from "./work-thread-commands.resolver"
import { ConfigurableModuleClass } from "./work-threads-graphql.module-definition"
import { WorkThreadsResolver } from "./work-threads.resolver"

@Module({
    imports: [WorkThreadsApiModule.register({})],
    providers: [WorkThreadsResolver, WorkThreadCommandsResolver],
})
/** GraphQL transport for work threads: reading them, writing in them and deciding their approval cards. */
export class WorkThreadsGraphqlModule extends ConfigurableModuleClass {}
