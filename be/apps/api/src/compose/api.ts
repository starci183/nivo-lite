import type { DynamicModule } from "@nestjs/common"
import { AutomationsGraphqlModule } from "@features/api/automations"
import { FlowsGraphqlModule } from "@features/api/flows"
import { N8nPipelinesHttpModule } from "@features/api/n8n-pipelines"
import { ApiKeysGraphqlModule } from "@features/api/api-keys"
import { DataHubGraphqlModule } from "@features/api/data-hub"
import { HiringGraphqlModule } from "@features/api/hiring"
import { InventoryGraphqlModule } from "@features/api/inventory"
import { ShiftsGraphqlModule } from "@features/api/shifts"
import { OverviewGraphqlModule } from "@features/api/overview"
import { AdminGraphqlModule } from "@features/api/admin"
import { WorkspacesGraphqlModule } from "@features/api/workspaces"
import { InboxGraphqlModule } from "@features/api/inbox"
import { AgentChatGraphqlModule } from "@features/api/agentchat"
import { ChatMarkersGraphqlModule } from "@features/api/chatmarkers"
import { ChattypingGraphqlModule } from "@features/api/chattyping"
import { AgentChatModule } from "@modules/domain/agent-chat"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { EvidenceGraphqlModule } from "@features/api/evidence"
import { McpGatewayGraphqlModule } from "@features/api/mcp-gateway"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { MetaHttpModule } from "@features/webhooks/meta"
import { ConnectionsGraphqlModule } from "@features/api/connections"
/** The api area of the API, in registration order. */
export const apiModules = (): Array<DynamicModule> => [
    WorkspacesGraphqlModule.register({}),
    ApiKeysGraphqlModule.register({}),
    InventoryGraphqlModule.register({}),
    ShiftsGraphqlModule.register({}),
    HiringGraphqlModule.register({}),
    OverviewGraphqlModule.register({}),
    AccountGraphqlModule.register({}),
    ShellGraphqlModule.register({}),
    ConnectionsGraphqlModule.register({}),
    DataHubGraphqlModule.register({}),
    InboxGraphqlModule.register({}),
    AgentChatGraphqlModule.register({}),
    ChatMarkersGraphqlModule.register({}),
    ChattypingGraphqlModule.register({}),
    AgentChatModule.register({ isGlobal: true }),
    KnowledgeGraphqlModule.register({}),
    EvidenceGraphqlModule.register({}),
    McpGatewayGraphqlModule.register({}),
    GoogleConnectionsHttpModule.register({}),
    MetaConnectionsHttpModule.register({}),
    MetaHttpModule.register({}),
    AutomationsGraphqlModule.register({}),
    FlowsGraphqlModule.register({}),
    N8nPipelinesHttpModule.register({}),
    AdminGraphqlModule.register({}),
]
