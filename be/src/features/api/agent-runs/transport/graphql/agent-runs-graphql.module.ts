import { Module } from "@nestjs/common"
import { AgentRunsApiModule } from "../../agent-runs.module"
import { ConfigurableModuleClass } from "./agent-runs-graphql.module-definition"
import { CancelAgentRunResolver } from "./cancel-agent-run.resolver"
import { DecideRunStopResolver } from "./decide-run-stop.resolver"
import { ResumeAgentRunResolver } from "./resume-agent-run.resolver"

@Module({
    imports: [AgentRunsApiModule.register({})],
    providers: [ResumeAgentRunResolver, CancelAgentRunResolver, DecideRunStopResolver],
})
/** The GraphQL transport of the agent-runs feature. */
export class AgentRunsGraphqlModule extends ConfigurableModuleClass {}
