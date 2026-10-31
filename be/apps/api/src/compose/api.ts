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
import { AgentWorkGraphqlModule } from "@features/api/agent-work"
import { ChatMarkersGraphqlModule } from "@features/api/chatmarkers"
import { ChattypingGraphqlModule } from "@features/api/chattyping"
import { AGENT_CHAT_ERROR_KINDS, AGENT_CHAT_MESSAGES, AgentChatModule } from "@modules/domain/agent-chat"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { DossierReviewGraphqlModule } from "@features/api/dossier-review"
import { EvidenceGraphqlModule } from "@features/api/evidence"
import { AgentGraphsGraphqlModule } from "@features/api/agent-graphs"
import { McpGatewayGraphqlModule } from "@features/api/mcp-gateway"
import { AuthGraphqlModule, AuthHttpModule } from "@features/api/auth"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { MetaHttpModule } from "@features/webhooks/meta"
import { ConnectionsGraphqlModule } from "@features/api/connections"
import { SepayConnectionGraphqlModule } from "@features/api/sepay-connection"
import { ZaloConnectionPageGraphqlModule } from "@features/api/zalo-connection-page"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
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
    SepayConnectionGraphqlModule.register({}),
    ZaloConnectionPageGraphqlModule.register({}),
    DataHubGraphqlModule.register({}),
    InboxGraphqlModule.register({}),
    AgentChatGraphqlModule.register({}),
    AgentWorkGraphqlModule.register({}),
    ChatMarkersGraphqlModule.register({}),
    ChattypingGraphqlModule.register({}),
    AgentChatModule.register({ isGlobal: true }),
    KnowledgeGraphqlModule.register({}),
    DossierReviewGraphqlModule.register({}),
    EvidenceGraphqlModule.register({}),
    McpGatewayGraphqlModule.register({}),
    AgentGraphsGraphqlModule.register({}),
    AuthGraphqlModule.register({}),
    AuthHttpModule.register({}),
    GoogleConnectionsHttpModule.register({}),
    MetaConnectionsHttpModule.register({}),
    MetaHttpModule.register({}),
    AutomationsGraphqlModule.register({}),
    FlowsGraphqlModule.register({}),
    N8nPipelinesHttpModule.register({}),
    AdminGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const apiErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [AGENT_CHAT_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const apiMessages: ReadonlyArray<MessageBundle> = [AGENT_CHAT_MESSAGES]
