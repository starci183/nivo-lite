import { Module } from "@nestjs/common"
import { CreateAgentHandler } from "./application/create-agent.handler"
import { GenerateTextHandler } from "./application/generate-text.handler"
import { GetAgentDashboardHandler } from "./application/get-agent-dashboard.handler"
import { GetEngineStatusHandler } from "./application/get-engine-status.handler"
import { GrantAgentConnectionHandler } from "./application/grant-agent-connection.handler"
import { ListAgentConnectionsHandler } from "./application/list-agent-connections.handler"
import { ListAgentsHandler } from "./application/list-agents.handler"
import { RenameAgentHandler } from "./application/rename-agent.handler"
import { RequestAgentSyncHandler } from "./application/request-agent-sync.handler"
import { RevokeAgentConnectionHandler } from "./application/revoke-agent-connection.handler"
import { SetAgentStatusHandler } from "./application/set-agent-status.handler"
import { SetAgentTextsHandler } from "./application/set-agent-texts.handler"

@Module({
    providers: [
        CreateAgentHandler,
        GenerateTextHandler,
        GetAgentDashboardHandler,
        GetEngineStatusHandler,
        GrantAgentConnectionHandler,
        ListAgentConnectionsHandler,
        ListAgentsHandler,
        RenameAgentHandler,
        RequestAgentSyncHandler,
        RevokeAgentConnectionHandler,
        SetAgentStatusHandler,
        SetAgentTextsHandler,
    ],
})
/** The agents feature: the handlers of its application. */
export class AgentsApiModule {}
