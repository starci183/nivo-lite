import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agents.module-definition"
import { AgentConnectionCandidatesHandler } from "./application/agent-connection-candidates.handler"
import { AskGuideHandler } from "./application/ask-guide.handler"
import { AssignAgentWorkHandler } from "./application/assign-agent-work.handler"
import { CreateAgentHandler } from "./application/create-agent.handler"
import { GenerateTextHandler } from "./application/generate-text.handler"
import { GetAgentDashboardHandler } from "./application/get-agent-dashboard.handler"
import { GetAgentPageHandler } from "./application/get-agent-page.handler"
import { GetEngineStatusHandler } from "./application/get-engine-status.handler"
import { GetGenerationStatusHandler } from "./application/get-generation-status.handler"
import { GrantAgentConnectionHandler } from "./application/grant-agent-connection.handler"
import { ListAgentConnectionsHandler } from "./application/list-agent-connections.handler"
import { ListAgentsHandler } from "./application/list-agents.handler"
import { RenameAgentHandler } from "./application/rename-agent.handler"
import { RequestAgentAvatarUploadHandler } from "./application/request-agent-avatar-upload.handler"
import { RequestAgentSyncHandler } from "./application/request-agent-sync.handler"
import { RequestGenerationHandler } from "./application/request-generation.handler"
import { RevokeAgentConnectionHandler } from "./application/revoke-agent-connection.handler"
import { SetAgentAvatarHandler } from "./application/set-agent-avatar.handler"
import { SetAgentOwnershipHandler } from "./application/set-agent-ownership.handler"
import { SetAgentStatusHandler } from "./application/set-agent-status.handler"
import { SetAgentTextsHandler } from "./application/set-agent-texts.handler"

@Module({
    providers: [
        AgentConnectionCandidatesHandler,
        AskGuideHandler,
        AssignAgentWorkHandler,
        CreateAgentHandler,
        GenerateTextHandler,
        GetAgentDashboardHandler,
        GetAgentPageHandler,
        GetEngineStatusHandler,
        GetGenerationStatusHandler,
        GrantAgentConnectionHandler,
        ListAgentConnectionsHandler,
        ListAgentsHandler,
        RenameAgentHandler,
        RequestAgentAvatarUploadHandler,
        RequestAgentSyncHandler,
        RequestGenerationHandler,
        RevokeAgentConnectionHandler,
        SetAgentAvatarHandler,
        SetAgentOwnershipHandler,
        SetAgentStatusHandler,
        SetAgentTextsHandler,
    ],
})
/** The agents feature: the handlers of its application. */
export class AgentsApiModule extends ConfigurableModuleClass {}
