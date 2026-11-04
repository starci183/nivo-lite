import { Module } from "@nestjs/common"
import { AgentRunsApiModule } from "../../agent-runs.module"
import { ConfigurableModuleClass } from "./agent-runs-graphql.module-definition"
import { ResumeAgentRunResolver } from "./resume-agent-run.resolver"

@Module({
    imports: [AgentRunsApiModule.register({})],
    providers: [ResumeAgentRunResolver],
})
/** The GraphQL transport of the agent-runs feature. */
export class AgentRunsGraphqlModule extends ConfigurableModuleClass {}
