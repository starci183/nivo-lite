import { Module } from "@nestjs/common"
import { AgentWorkApiModule } from "../../agent-work.module"
import { AgentWorkCommandsResolver } from "./agent-work-commands.resolver"
import { ConfigurableModuleClass } from "./agent-work-graphql.module-definition"
import { AgentWorkResolver } from "./agent-work.resolver"

@Module({
    imports: [AgentWorkApiModule.register({})],
    providers: [AgentWorkResolver, AgentWorkCommandsResolver],
})
/** GraphQL transport for the Work tab: reading it, the two switches, goals, triggers and tasks. */
export class AgentWorkGraphqlModule extends ConfigurableModuleClass {}
