import type { DynamicModule, Type } from "@nestjs/common"
import { CliModule } from "@features/cli"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { ChannelProvisioningModule } from "@modules/domain/channel-provisioning"
import { AgentBindingsService, AgentConnectionsModule } from "@modules/domain/agent-connections"
import { ConnectionGrantsModule } from "@modules/domain/connection-grants"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { AutomationTemplatesModule } from "@modules/domain/automation-templates"
import { N8nHostModule } from "@modules/integrations/n8n-host"
import { DataRecordsModule } from "@modules/domain/data-records"
import { EventsModule } from "@modules/domain/events"
import { JobOpsModule } from "@modules/domain/job-ops"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { AgentDirectoryService, AgentRecordsService } from "@modules/domain/agents"
import { ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { McpGatewayAdminService, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { TransactionsModule } from "@modules/domain/transactions"
import { WorkspaceSeedModule } from "@modules/domain/workspace-seed"
import { WorkspaceCleanupModule } from "@modules/domain/workspace-cleanup"
import { CORE_FOLDER, NIVO_KNOWLEDGE_MESSAGES, NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { VideoMusicModule } from "@modules/domain/video-music"
import { AiModule } from "@modules/integrations/ai"
import { HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { STORAGE_ASSETS, ObjectStorageModule } from "@modules/integrations/object-storage"
import { IDENTITY_ACCOUNTS, IDENTITY_AUTHENTICATOR, IdentityModule } from "@modules/domain/identity"
import { MailModule } from "@modules/integrations/mail"
import { PASSPORT_TOKENS, PassportModule } from "@modules/integrations/passport"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { AuthorityRulesModule } from "@modules/domain/authority-rules"
import { MemberGrantsModule, OfficeAuthorityService } from "@modules/domain/member-grants"
import { MODULE_KNOWLEDGE_FOLDERS, MODULES_MESSAGES } from "@modules/domain/modules"
import { OwnersModule } from "@modules/domain/owners"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { OfficeRoomsModule } from "@modules/domain/office-rooms"
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { DatabaseModule } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { appPgTypes } from "@modules/integrations/data-sources"
import { EventBusModule } from "@modules/platform/event-bus"
import { QueueModule } from "@modules/platform/queue"
import type { QueueOptions } from "@modules/platform/queue"
import { LoggingModule, printConsoleLine } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"

/** The queue of the CLI: producers only, so no worker and no relay run. */
const CLI_QUEUE: QueueOptions = {
    enabled: false,
    redisHost: "127.0.0.1",
    redisPort: 6379,
    redisDb: 0,
    prefix: "nivo",
    concurrency: 1,
    workspaceConcurrency: 1,
    relayIntervalMs: 500,
    relayBatch: 50,
    reconcileAfterMs: 15_000,
    visibilityTimeoutMs: 60_000,
    shutdownGraceMs: 1000,
    schedulers: [],
}

/** Registers the CLI capabilities in their boot order, with queue producers only. */
export const cliModules = (options: CliAppOptions): Array<DynamicModule | Type> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    // Info lines go to stderr: a command's stdout is its report alone (`jobs watchdog` prints `<n> <n>`, the deploy verify matches it).
    LoggingModule.register({ isGlobal: true, info: "stderr" }),
    OwnersModule.register({ isGlobal: true, print: printConsoleLine }),
    DatabaseModule.register({
        isGlobal: true,
        connections: options.connections,
        entities: PRIMARY_ENTITIES,
        typeParsers: appPgTypes,
    }),
    I18nModule.register({ isGlobal: true, bundles: [NIVO_KNOWLEDGE_MESSAGES, MODULES_MESSAGES] }),
    HttpModule.register({ isGlobal: true }),
    AiModule.register({ isGlobal: true, ...options.ai }),
    NivoKnowledgeModule.register({
        isGlobal: true,
        folders: [CORE_FOLDER, ...MODULE_KNOWLEDGE_FOLDERS],
    }),
    AutomationTemplatesModule.register({ isGlobal: true }),
    N8nHostModule.register({ isGlobal: true, ...options.n8nHost }),
    MailModule.register({ isGlobal: true, ...options.mail }),
    PassportModule.register({ isGlobal: true, ...options.passport, authenticator: IDENTITY_AUTHENTICATOR }),
    IdentityModule.register({ isGlobal: true, tokens: PASSPORT_TOKENS, auth: options.identityAuth }),
    ObjectStorageModule.register({ isGlobal: true, ...options.storage }),
    VideoMusicModule.register({ isGlobal: true, store: STORAGE_ASSETS }),
    EventsModule.register({ isGlobal: true }),
    QueueModule.register({ isGlobal: true, ...CLI_QUEUE }),
    EventBusModule.register({ isGlobal: true }),
    JobOpsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: true }),
    AuthorityRulesModule.register({ isGlobal: true }),
    OfficeRoomsModule.register({ isGlobal: true, directoryOnly: true }),
    MemberGrantsModule.register({ isGlobal: true }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    DataRecordsModule.register({ isGlobal: true }),
    McpGatewayModule.register({ isGlobal: true, ...options.mcpGateway, console: true }),
    WorkspaceSeedModule.register({
        isGlobal: true,
        auth: IDENTITY_ACCOUNTS,
        ports: {
            agents: AgentRecordsService,
            sources: ProfileSourcesService,
            toolGrants: McpToolGrantsService,
            connectors: McpGatewayAdminService,
            officeAuthority: OfficeAuthorityService,
        },
        print: printConsoleLine,
        ...options.workspaceSeed,
    }),
    WorkspaceCleanupModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS, print: printConsoleLine }),
    AuthorityActionsModule.register({ isGlobal: true }),
    ConnectionSecretsModule.register({
        isGlobal: true,
        tokenKey: options.channelConnections.channelTokenKey,
    }),
    ConnectionsModule.register({
        isGlobal: true,
        ...options.channelConnections,
        ports: { agents: AgentBindingsService },
    }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    ConnectionGrantsModule.register({ isGlobal: true }),
    ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    ChannelProvisioningModule.register({ isGlobal: true, ...options.channelProvisioning }),
    CliModule.register({}),
]
