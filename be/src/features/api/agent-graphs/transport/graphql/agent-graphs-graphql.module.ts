import { Module } from "@nestjs/common"
import { AgentGraphsApiModule } from "../../agent-graphs.module"
import { ConfigurableModuleClass } from "./agent-graphs-graphql.module-definition"
import { GetAgentGraphResolver } from "./get-agent-graph.resolver"
import { ListAgentGraphVersionsResolver } from "./list-agent-graph-versions.resolver"
import { SaveAgentGraphDraftResolver } from "./save-agent-graph-draft.resolver"
import { PublishAgentGraphResolver } from "./publish-agent-graph.resolver"
import { RestoreAgentGraphVersionResolver } from "./restore-agent-graph-version.resolver"
import { SetAgentGraphModeResolver } from "./set-agent-graph-mode.resolver"
import { DeclineAgentGraphProposalResolver } from "./decline-agent-graph-proposal.resolver"

@Module({
    imports: [AgentGraphsApiModule.register({})],
    providers: [
        GetAgentGraphResolver,
        ListAgentGraphVersionsResolver,
        SaveAgentGraphDraftResolver,
        PublishAgentGraphResolver,
        RestoreAgentGraphVersionResolver,
        SetAgentGraphModeResolver,
        DeclineAgentGraphProposalResolver,
    ],
})
/** The GraphQL transport of the agent graph editor. */
export class AgentGraphsGraphqlModule extends ConfigurableModuleClass {}
