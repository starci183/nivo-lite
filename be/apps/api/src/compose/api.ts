import type { DynamicModule } from "@nestjs/common"
import { ApiKeysGraphqlModule } from "@features/api/api-keys"
import { DataHubGraphqlModule } from "@features/api/data-hub"
import { AdminGraphqlModule } from "@features/api/admin"
import { WorkspacesGraphqlModule } from "@features/api/workspaces"
import { WebsiteIntakeGraphqlModule } from "@features/api/website-intake"
import { WorkspaceDashboardGraphqlModule } from "@features/api/workspace-dashboard"
import { AgentWorkGraphqlModule } from "@features/api/agent-work"
import { AgentRunsGraphqlModule } from "@features/api/agent-runs"
import { AgentDoorsGraphqlModule } from "@features/api/agent-doors"
import { SchedulesGraphqlModule } from "@features/api/schedules"
import { TeamChatGraphqlModule } from "@features/api/team-chat"
import { TeamChatTurnsGraphqlModule } from "@features/api/team-chat-turns"
import { ChattypingGraphqlModule } from "@features/api/chattyping"
import { ChatFilesModule } from "@modules/domain/chat-files"
import { STORAGE_ASSETS, STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { BrainGraphGraphqlModule } from "@features/api/brain-graph"
import { BrainPoliciesGraphqlModule } from "@features/api/brain-policies"
import { BrainCriticGraphqlModule } from "@features/api/brain-critic"
import { PublicDocumentsGraphqlModule } from "@features/api/public-documents"
import { ContactsGraphqlModule } from "@features/api/contacts"
import { WorkspaceThemeGraphqlModule } from "@features/api/workspace-theme"
import { ProviderSandboxGraphqlModule } from "@features/api/provider-sandbox"
import { AgentGraphsGraphqlModule } from "@features/api/agent-graphs"
import { AgentWorkflowsGraphqlModule } from "@features/api/agent-workflows"
import { ToolsGraphqlModule } from "@features/api/tools"
import { AuthHttpModule } from "@features/api/auth"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { MetaHttpModule } from "@features/webhooks/meta"
import { ConnectionsGraphqlModule } from "@features/api/connections"
import { SepayConnectionGraphqlModule } from "@features/api/sepay-connection"
import { ZaloConnectionPageGraphqlModule } from "@features/api/zalo-connection-page"
import { TelegramConnectionPageGraphqlModule } from "@features/api/telegram-connection-page"
/** The api area of the API, in registration order. */
export const apiModules = (): Array<DynamicModule> => [
    WorkspacesGraphqlModule.register({}),
    ApiKeysGraphqlModule.register({}),
    AccountGraphqlModule.register({}),
    ShellGraphqlModule.register({}),
    ConnectionsGraphqlModule.register({}),
    SepayConnectionGraphqlModule.register({}),
    ZaloConnectionPageGraphqlModule.register({}),
    TelegramConnectionPageGraphqlModule.register({}),
    DataHubGraphqlModule.register({}),
    WebsiteIntakeGraphqlModule.register({}),
    WorkspaceDashboardGraphqlModule.register({}),
    AgentWorkGraphqlModule.register({}),
    AgentRunsGraphqlModule.register({}),
    SchedulesGraphqlModule.register({}),
    AgentDoorsGraphqlModule.register({}),
    TeamChatGraphqlModule.register({}),
    TeamChatTurnsGraphqlModule.register({}),
    ChattypingGraphqlModule.register({}),
    ChatFilesModule.register({ isGlobal: true, storage: STORAGE_OBJECTS, assets: STORAGE_ASSETS }),
    KnowledgeGraphqlModule.register({}),
    BrainGraphGraphqlModule.register({}),
    BrainPoliciesGraphqlModule.register({}),
    BrainCriticGraphqlModule.register({}),
    PublicDocumentsGraphqlModule.register({}),
    ProviderSandboxGraphqlModule.register({}),
    ContactsGraphqlModule.register({}),
    WorkspaceThemeGraphqlModule.register({}),
    ToolsGraphqlModule.register({}),
    AgentGraphsGraphqlModule.register({}),
    AgentWorkflowsGraphqlModule.register({}),
    AuthHttpModule.register({}),
    GoogleConnectionsHttpModule.register({}),
    MetaConnectionsHttpModule.register({}),
    MetaHttpModule.register({}),
    AdminGraphqlModule.register({}),
]
