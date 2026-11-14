import type { DynamicModule, Type } from "@nestjs/common"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { NodeInstall } from "@nivo-lite/agent-sdk/node"
import { CliModule } from "@features/cli"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { ChannelProvisioningModule } from "@modules/domain/channel-provisioning"
import { AgentGraphsModule } from "@modules/domain/agent-graphs"
import { AgentBindingsService, AgentConnectionsModule } from "@modules/domain/agent-connections"
import { ConnectionGrantsModule } from "@modules/domain/connection-grants"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { AccountDataModule } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "@modules/domain/account-data-catalog"
import { DataRecordsModule } from "@modules/domain/data-records"
import { EmailMessagesModule } from "@modules/domain/email-messages"
import { ProviderSandboxModule } from "@modules/domain/provider-sandbox"
import { EntityPlannerModule } from "@modules/domain/entity-planner"
import { EventsModule } from "@modules/domain/events"
import { JobOpsModule } from "@modules/domain/job-ops"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { AgentDirectoryService, AgentRecordsService } from "@modules/domain/agents"
import { BrainModule } from "@modules/domain/brain"
import { KnowledgeSourcesModule } from "@modules/domain/knowledge-sources"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { ToolsModule } from "@modules/domain/tools"
import { ToolCallLogModule } from "@modules/domain/tool-call-log"
import { WorkspaceSeedModule } from "@modules/domain/workspace-seed"
import { WorkspaceCleanupModule } from "@modules/domain/workspace-cleanup"
import { CORE_FOLDER, NIVO_KNOWLEDGE_MESSAGES, NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { AiModule } from "@modules/integrations/ai"
import { chatProfileRoutes } from "@modules/integrations/ai-gateway"
import { HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { ObjectStorageModule } from "@modules/integrations/object-storage"
import { IDENTITY_ACCOUNTS, IDENTITY_AUTHENTICATOR, IdentityModule } from "@modules/domain/identity"
import { MailModule } from "@modules/integrations/mail"
import { PassportModule } from "@modules/integrations/passport"
import { MODULE_KNOWLEDGE_FOLDERS, MODULES_MESSAGES } from "@modules/domain/modules"
import { OwnersModule } from "@modules/domain/owners"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { DatabaseModule } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { appPgTypes } from "@modules/integrations/data-sources"
import { EventBusModule } from "@modules/platform/event-bus"
import { QueueModule, type QueueOptions } from "@modules/platform/queue"
import { LoggingModule, printConsoleLine } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"
import { entityEngineStoreModules } from "./entity-engine"

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

/** The nodes the graphs a seed publishes are judged against: those of every installed plugin, the core package among them. */
const GRAPH_NODES: NodeInstall = INSTALLED.nodeInstall()

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
    AiModule.register({ isGlobal: true, ...options.ai, profileRoutes: chatProfileRoutes() }),
    // Publishing only: the cli has no vector index; the items' sync jobs it writes are run by the api's worker.
    NivoKnowledgeModule.register({
        isGlobal: true,
        publishOnly: true,
        folders: [CORE_FOLDER, ...MODULE_KNOWLEDGE_FOLDERS],
    }),
    MailModule.register({ isGlobal: true, ...options.mail }),
    PassportModule.register({ isGlobal: true, ...options.passport, authenticator: IDENTITY_AUTHENTICATOR }),
    IdentityModule.register({ isGlobal: true, ownTokens: true, auth: options.identityAuth }),
    ObjectStorageModule.register({ isGlobal: true, ...options.storage }),
    EventsModule.register({ isGlobal: true }),
    QueueModule.register({ isGlobal: true, ...CLI_QUEUE }),
    EventBusModule.register({ isGlobal: true }),
    JobOpsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: true }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    AccountDataModule.register({ isGlobal: true, types: ACCOUNT_DATA_CATALOG }),
    DataRecordsModule.register({ isGlobal: true }),
    ToolCallLogModule.register({ isGlobal: true }),
    ToolsModule.register({ isGlobal: true, ...options.toolsConfig, console: true }),
    WorkspaceSeedModule.register({
        isGlobal: true,
        auth: IDENTITY_ACCOUNTS,
        ports: { agents: AgentRecordsService },
        nodes: GRAPH_NODES,
        print: printConsoleLine,
        ...options.workspaceSeed,
    }),
    ...entityEngineStoreModules(options),
    AgentGraphsModule.register({ isGlobal: true, storeOnly: true }),
    WorkspaceCleanupModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS, print: printConsoleLine }),
    ConnectionSecretsModule.register({
        isGlobal: true,
        tokenKey: options.channelConnections.channelTokenKey,
    }),
    ConnectionsModule.register({
        isGlobal: true,
        ...options.channelConnections,
        readOnly: false,
        ports: { agents: AgentBindingsService },
    }),
    // The workspace mail resolves an SMTP account through its registry, whose sandbox twin answers through the sandbox frame: the CLI
    // composes the frame with the dev switch OFF (no sandbox call is ever answered here; a live account never reaches it).
    ProviderSandboxModule.register({ isGlobal: true, sandbox: { enabled: false } }),
    EmailMessagesModule.register({ isGlobal: true }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    ConnectionGrantsModule.register({ isGlobal: true }),
    ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    KnowledgeSourcesModule.register({ isGlobal: true, seedOnly: true }),
    BrainModule.register({ isGlobal: true, derivationsOnly: true }),
    ChannelProvisioningModule.register({ isGlobal: true, ...options.channelProvisioning }),
    EntityPlannerModule.register({ isGlobal: true, entities: INSTALLED.entities() }),
    CliModule.register({}),
]
