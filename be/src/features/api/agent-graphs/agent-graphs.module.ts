import { Module } from "@nestjs/common"
import { GetAgentGraphHandler } from "./application/get-agent-graph.handler"
import { ListAgentGraphVersionsHandler } from "./application/list-agent-graph-versions.handler"
import { SaveAgentGraphDraftHandler } from "./application/save-agent-graph-draft.handler"
import { PublishAgentGraphHandler } from "./application/publish-agent-graph.handler"
import { RestoreAgentGraphVersionHandler } from "./application/restore-agent-graph-version.handler"
import { SetAgentGraphModeHandler } from "./application/set-agent-graph-mode.handler"
import { DeclineAgentGraphProposalHandler } from "./application/decline-agent-graph-proposal.handler"
import { ConfigurableModuleClass } from "./agent-graphs.module-definition"

@Module({
    providers: [
        GetAgentGraphHandler,
        ListAgentGraphVersionsHandler,
        SaveAgentGraphDraftHandler,
        PublishAgentGraphHandler,
        RestoreAgentGraphVersionHandler,
        SetAgentGraphModeHandler,
        DeclineAgentGraphProposalHandler,
    ],
})
/** The agent graph feature: the editor of the flow each agent follows. */
export class AgentGraphsApiModule extends ConfigurableModuleClass {}
