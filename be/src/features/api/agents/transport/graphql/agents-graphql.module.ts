import { Module } from "@nestjs/common"
import { AgentsApiModule } from "../../agents.module"
import { AgentConnectionsResolver } from "./agent-connections.resolver"
import { AgentDashboardResolver } from "./agent-dashboard.resolver"
import { AgentEngineStatusResolver } from "./agent-engine-status.resolver"
import { AgentsResolver } from "./agents.resolver"
import { CreateAgentResolver } from "./create-agent.resolver"
import { GrantAgentConnectionResolver } from "./grant-agent-connection.resolver"
import { RenameAgentResolver } from "./rename-agent.resolver"
import { RequestAgentSyncResolver } from "./request-agent-sync.resolver"
import { RevokeAgentConnectionResolver } from "./revoke-agent-connection.resolver"
import { SetAgentStatusResolver } from "./set-agent-status.resolver"
import { SetAgentTextsResolver } from "./set-agent-texts.resolver"

@Module({
    imports: [AgentsApiModule],
    providers: [
        AgentsResolver,
        AgentDashboardResolver,
        AgentEngineStatusResolver,
        AgentConnectionsResolver,
        CreateAgentResolver,
        RenameAgentResolver,
        SetAgentStatusResolver,
        SetAgentTextsResolver,
        RequestAgentSyncResolver,
        GrantAgentConnectionResolver,
        RevokeAgentConnectionResolver,
    ],
})
/** The GraphQL transport of the agents feature. */
export class AgentsGraphqlModule {}
