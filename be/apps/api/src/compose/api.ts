import type { DynamicModule } from "@nestjs/common"
import { FlowsGraphqlModule } from "@features/api/flows"
import { ApiKeysGraphqlModule } from "@features/api/api-keys"
import { DataHubGraphqlModule } from "@features/api/data-hub"
import { HiringGraphqlModule } from "@features/api/hiring"
import { InventoryGraphqlModule } from "@features/api/inventory"
import { ShiftsGraphqlModule } from "@features/api/shifts"
import { AdminGraphqlModule } from "@features/api/admin"
import { WorkspacesGraphqlModule } from "@features/api/workspaces"
import { InboxGraphqlModule } from "@features/api/inbox"
import { AgentWorkGraphqlModule } from "@features/api/agent-work"
import { AgentRunsGraphqlModule } from "@features/api/agent-runs"
import { TeamChatGraphqlModule } from "@features/api/team-chat"
import { ChattypingGraphqlModule } from "@features/api/chattyping"
import { CHAT_FILES_ERROR_KINDS, CHAT_FILES_MESSAGES, ChatFilesModule } from "@modules/domain/chat-files"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { PublicDocumentsGraphqlModule } from "@features/api/public-documents"
import { DossierReviewGraphqlModule } from "@features/api/dossier-review"
import { EvidenceGraphqlModule } from "@features/api/evidence"
import { AgentGraphsGraphqlModule } from "@features/api/agent-graphs"
import { TemplateMarketplaceGraphqlModule } from "@features/api/template-marketplace"
import { McpGatewayGraphqlModule } from "@features/api/mcp-gateway"
import { AuthHttpModule } from "@features/api/auth"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { MetaHttpModule } from "@features/webhooks/meta"
import { ConnectionsGraphqlModule } from "@features/api/connections"
import { SepayConnectionGraphqlModule } from "@features/api/sepay-connection"
import { ZaloConnectionPageGraphqlModule } from "@features/api/zalo-connection-page"
import { TelegramConnectionPageGraphqlModule } from "@features/api/telegram-connection-page"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The api area of the API, in registration order. */
export const apiModules = (): Array<DynamicModule> => [
    WorkspacesGraphqlModule.register({}),
    ApiKeysGraphqlModule.register({}),
    InventoryGraphqlModule.register({}),
    ShiftsGraphqlModule.register({}),
    HiringGraphqlModule.register({}),
    AccountGraphqlModule.register({}),
    ShellGraphqlModule.register({}),
    ConnectionsGraphqlModule.register({}),
    SepayConnectionGraphqlModule.register({}),
    ZaloConnectionPageGraphqlModule.register({}),
    TelegramConnectionPageGraphqlModule.register({}),
    DataHubGraphqlModule.register({}),
    InboxGraphqlModule.register({}),
    AgentWorkGraphqlModule.register({}),
    AgentRunsGraphqlModule.register({}),
    TeamChatGraphqlModule.register({}),
    ChattypingGraphqlModule.register({}),
    ChatFilesModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    KnowledgeGraphqlModule.register({}),
    PublicDocumentsGraphqlModule.register({}),
    DossierReviewGraphqlModule.register({}),
    EvidenceGraphqlModule.register({}),
    McpGatewayGraphqlModule.register({}),
    AgentGraphsGraphqlModule.register({}),
    TemplateMarketplaceGraphqlModule.register({}),
    AuthHttpModule.register({}),
    GoogleConnectionsHttpModule.register({}),
    MetaConnectionsHttpModule.register({}),
    MetaHttpModule.register({}),
    FlowsGraphqlModule.register({}),
    AdminGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const apiErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [CHAT_FILES_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const apiMessages: ReadonlyArray<MessageBundle> = [CHAT_FILES_MESSAGES]
