import { Module } from "@nestjs/common"
import { AgentWorkApiModule } from "../../agent-work.module"
import { AgentWorkCommandsResolver } from "./agent-work-commands.resolver"
import { ConfigurableModuleClass } from "./agent-work-graphql.module-definition"
import { AgentRunDecisionResolver } from "./agent-run-decision.resolver"
import { AgentRunsResolver } from "./agent-runs.resolver"
import { AgentWorkResolver } from "./agent-work.resolver"
import { RunFlowResolver } from "./run-flow.resolver"

@Module({
    imports: [AgentWorkApiModule.register({})],
    providers: [AgentWorkResolver, AgentRunsResolver, AgentRunDecisionResolver, AgentWorkCommandsResolver, RunFlowResolver],
})
/** GraphQL transport for the Work tab: reading it, the two switches, goals, triggers and tasks. */
export class AgentWorkGraphqlModule extends ConfigurableModuleClass {}
