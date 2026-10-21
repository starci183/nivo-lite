import type { DynamicModule } from "@nestjs/common"
import { CliModule } from "@features/cli"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { ChannelProvisioningModule } from "@modules/domain/channel-provisioning"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { ConnectionGrantsModule } from "@modules/domain/connection-grants"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { AutomationTemplatesModule } from "@modules/domain/automation-templates"
import { N8nHostModule } from "@modules/integrations/n8n-host"
import { EventsModule } from "@modules/domain/events"
import { JobOpsModule } from "@modules/domain/job-ops"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { AgentRecordsService } from "@modules/domain/agents"
import { ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { McpGatewayAdminService, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { TransactionsModule } from "@modules/domain/transactions"
import { WorkspaceSeedModule } from "@modules/domain/workspace-seed"
import { WorkspaceCleanupModule } from "@modules/domain/workspace-cleanup"
import { CORE_FOLDER, NIVO_KNOWLEDGE_MESSAGES, NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { VideoMusicModule } from "@modules/domain/video-music"
import { LlmModule } from "@modules/integrations/llm"
import { HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { SUPABASE_ACCOUNTS, SUPABASE_AUTH, SUPABASE_STORAGE, SupabaseModule } from "@modules/integrations/supabase"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { AuthorityRulesModule } from "@modules/domain/authority-rules"
import { MODULE_KNOWLEDGE_FOLDERS, MODULES_MESSAGES } from "@modules/domain/modules"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { appPgTypes } from "@modules/integrations/data-sources"
import { QueueModule } from "@modules/platform/queue"
import { LoggingModule, printConsoleLine } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"

/** Registers the CLI capabilities in their boot order, with queue producers only. */
export const cliModules = (options: CliAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({
        isGlobal: true,
        connections: options.connections,
        typeParsers: appPgTypes,
    }),
    I18nModule.register({ isGlobal: true, bundles: [NIVO_KNOWLEDGE_MESSAGES, MODULES_MESSAGES] }),
    HttpModule.register({ isGlobal: true }),
    LlmModule.register({ isGlobal: true, ...options.llm }),
    NivoKnowledgeModule.register({
        isGlobal: true,
        folders: [CORE_FOLDER, ...MODULE_KNOWLEDGE_FOLDERS],
    }),
    AutomationTemplatesModule.register({ isGlobal: true }),
    N8nHostModule.register({ isGlobal: true, ...options.n8nHost }),
    SupabaseModule.register({ isGlobal: true, ...options.supabase }),
    VideoMusicModule.register({ isGlobal: true, store: SUPABASE_STORAGE }),
    EventsModule.register({ isGlobal: true }),
    QueueModule.register({
        isGlobal: true,
        enabled: false,
        concurrency: 1,
        workspaceConcurrency: 1,
        pollIntervalMs: 500,
        visibilityTimeoutMs: 60_000,
        shutdownGraceMs: 1000,
        schedulers: [],
    }),
    JobOpsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: true }),
    AuthorityRulesModule.register({ isGlobal: true }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    McpGatewayModule.register({ isGlobal: true, ...options.mcpGateway, console: true }),
    WorkspaceSeedModule.register({
        isGlobal: true,
        auth: SUPABASE_ACCOUNTS,
        ports: {
            agents: AgentRecordsService,
            sources: ProfileSourcesService,
            toolGrants: McpToolGrantsService,
            connectors: McpGatewayAdminService,
        },
        print: printConsoleLine,
        ...options.workspaceSeed,
    }),
    WorkspaceCleanupModule.register({ isGlobal: true, accounts: SUPABASE_ACCOUNTS, print: printConsoleLine }),
    AuthorityActionsModule.register({ isGlobal: true }),
    ConnectionSecretsModule.register({
        isGlobal: true,
        tokenKey: options.channelConnections.channelTokenKey,
    }),
    ConnectionsModule.register({ isGlobal: true, ...options.channelConnections }),
    AgentConnectionsModule.register({ isGlobal: true }),
    ConnectionGrantsModule.register({ isGlobal: true }),
    ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    ChannelProvisioningModule.register({ isGlobal: true, ...options.channelProvisioning }),
    CliModule.register({}),
]
