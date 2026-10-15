import type { ModuleMetadata } from "@nestjs/common"
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
import { InboxSimulationGraphqlModule } from "@features/api/inbox-simulation"
import { AgentChatModule } from "@modules/domain/agent-chat"
import { InboxSimulationModule } from "@modules/domain/inbox-simulation"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { EvidenceGraphqlModule } from "@features/api/evidence"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { ConnectionsGraphqlModule } from "@features/api/connections"
/** The api area of the API, in registration order. */
export const apiModules = (): NonNullable<ModuleMetadata["imports"]> => [
    WorkspacesGraphqlModule,
    ApiKeysGraphqlModule,
    InventoryGraphqlModule,
    ShiftsGraphqlModule,
    HiringGraphqlModule,
    OverviewGraphqlModule,
    AccountGraphqlModule,
    ShellGraphqlModule,
    ConnectionsGraphqlModule,
    DataHubGraphqlModule,
    InboxGraphqlModule,
    AgentChatGraphqlModule,
    InboxSimulationGraphqlModule,
    InboxSimulationModule.register({ isGlobal: true }),
    AgentChatModule.register({ isGlobal: true }),
    KnowledgeGraphqlModule,
    EvidenceGraphqlModule,
    GoogleConnectionsHttpModule,
    MetaConnectionsHttpModule,
    AutomationsGraphqlModule,
    FlowsGraphqlModule,
    N8nPipelinesHttpModule,
    AdminGraphqlModule,
]
