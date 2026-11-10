import { Module } from "@nestjs/common"
import { AgentsApiModule } from "../../agents.module"
import { AgentAvatarResolver } from "./agent-avatar.resolver"
import { AgentCatalogResolver } from "./agent-catalog.resolver"
import { AgentConnectionCandidatesResolver } from "./agent-connection-candidates.resolver"
import { AgentConnectionsResolver } from "./agent-connections.resolver"
import { ConnectionGrantsResolver } from "./connection-agent-grants.resolver"
import { AgentDashboardResolver } from "./agent-dashboard.resolver"
import { AgentEngineStatusResolver } from "./agent-engine-status.resolver"
import { AgentGenerationStatusResolver } from "./agent-generation-status.resolver"
import { AgentKnowledgeResolver } from "./agent-knowledge.resolver"
import { AgentPageResolver } from "./agent-page.resolver"
import { ConfigurableModuleClass } from "./agents-graphql.module-definition"
import { AgentsResolver } from "./agents.resolver"
import { AskGuideResolver } from "./ask-guide.resolver"
import { CreateAgentResolver } from "./create-agent.resolver"
import { GrantAgentConnectionResolver } from "./grant-agent-connection.resolver"
import { RenameAgentResolver } from "./rename-agent.resolver"
import { RequestAgentGenerationResolver } from "./request-agent-generation.resolver"
import { RequestAgentSyncResolver } from "./request-agent-sync.resolver"
import { RevokeAgentConnectionResolver } from "./revoke-agent-connection.resolver"
import { SetAgentOwnershipResolver } from "./set-agent-ownership.resolver"
import { SetAgentStatusResolver } from "./set-agent-status.resolver"
import { SetAgentTextsResolver } from "./set-agent-texts.resolver"

@Module({
    imports: [AgentsApiModule.register({})],
    providers: [
        AgentsResolver,
        AgentCatalogResolver,
        AgentDashboardResolver,
        AgentKnowledgeResolver,
        AgentPageResolver,
        SetAgentOwnershipResolver,
        AgentEngineStatusResolver,
        AgentConnectionCandidatesResolver,
        AgentConnectionsResolver,
        ConnectionGrantsResolver,
        RequestAgentGenerationResolver,
        AgentGenerationStatusResolver,
        AskGuideResolver,
        CreateAgentResolver,
        RenameAgentResolver,
        AgentAvatarResolver,
        SetAgentStatusResolver,
        SetAgentTextsResolver,
        RequestAgentSyncResolver,
        GrantAgentConnectionResolver,
        RevokeAgentConnectionResolver,
    ],
})
/** The GraphQL transport of the agents feature. */
export class AgentsGraphqlModule extends ConfigurableModuleClass {}
