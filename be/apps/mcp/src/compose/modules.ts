import type { DynamicModule, Type } from "@nestjs/common"
import { McpEndpointHttpModule } from "@features/api/mcp-endpoint"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { McpKeyAuthenticatorService } from "@modules/domain/api-credentials"
import {
    CONNECTION_SECRETS_MESSAGES,
    CONNECTION_SECRETS_ERROR_KINDS,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES, AgentGraphsModule } from "@modules/domain/agent-graphs"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { AgentsModule } from "@modules/domain/agents"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ChatRoomDirectoryService } from "@modules/domain/chat-room-directory"
import { InstallationDirectoryService } from "@modules/domain/modules"
import { ACCOUNT_DATA_ERROR_KINDS, ACCOUNT_DATA_MESSAGES, AccountDataModule } from "@modules/domain/account-data"
import { ACCOUNT_DATA_CATALOG } from "@modules/domain/account-data-catalog"
import { DataRecordsModule } from "@modules/domain/data-records"
import { EventsModule } from "@modules/domain/events"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule, refuseSessions } from "@modules/domain/identity"
import { LivenessModule } from "@modules/domain/liveness"
import { ToolCallLogModule } from "@modules/domain/tool-call-log"
import { TOOL_RECEIPTS_ERROR_KINDS, TOOL_RECEIPTS_MESSAGES } from "@modules/domain/tool-receipts"
import { BILLING_ERROR_KINDS, BILLING_MESSAGES, BillingModule } from "@modules/domain/billing"
import { RECORD_FILES_ERROR_KINDS, RECORD_FILES_MESSAGES, RecordFilesModule } from "@modules/domain/record-files"
import { OBJECT_STORAGE_ERROR_KINDS, ObjectStorageModule, STORAGE_FILES } from "@modules/integrations/object-storage"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { appPgTypes } from "@modules/integrations/data-sources"
import { MCP_ENDPOINT_ERROR_KINDS, MCP_ENDPOINT_MESSAGES, McpEndpointModule } from "@modules/domain/mcp-endpoint"
import { NIVO_API_ERROR_KINDS, NIVO_API_MESSAGES, NivoApiExecutorService } from "@modules/domain/nivo-api"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IdsModule } from "@modules/platform/ids"
import { JobsModule } from "@modules/platform/jobs"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { QueueModule } from "@modules/platform/queue"
import { RetryModule } from "@modules/platform/retry"
import type { McpAppOptions } from "../mcp.options"
import { mcpKnowledgeErrorKinds, mcpKnowledgeMessages, mcpKnowledgeModules } from "./knowledge"
import { mcpEndpointErrorKinds, mcpEndpointMessages, mcpEndpointModules } from "./endpoint"
import { nivoApiModules } from "./nivo-api"

/** The message bundles of what the mcp app composes. */
const MCP_BUNDLES = [
    ACCOUNT_DATA_MESSAGES,
    AGENT_GRAPHS_MESSAGES,
    API_KEYS_MESSAGES,
    CONNECTION_SECRETS_MESSAGES,
    ERRORS_MESSAGES,
    HTTP_SECURITY_MESSAGES,
    IDENTITY_MESSAGES,
    ...mcpKnowledgeMessages,
    ...mcpEndpointMessages,
    TOOL_RECEIPTS_MESSAGES,
    MCP_ENDPOINT_MESSAGES,
    NIVO_API_MESSAGES,
    BILLING_MESSAGES,
    RECORD_FILES_MESSAGES,
]

/** The error kind tables of what the mcp app composes. */
const MCP_ERROR_KIND_TABLES = [
    ACCOUNT_DATA_ERROR_KINDS,
    AGENT_GRAPHS_ERROR_KINDS,
    API_KEYS_ERROR_KINDS,
    CONFIG_ERROR_KINDS,
    CONNECTION_SECRETS_ERROR_KINDS,
    HTTP_SECURITY_ERROR_KINDS,
    IDENTITY_ERROR_KINDS,
    ...mcpKnowledgeErrorKinds,
    ...mcpEndpointErrorKinds,
    TOOL_RECEIPTS_ERROR_KINDS,
    MCP_ENDPOINT_ERROR_KINDS,
    NIVO_API_ERROR_KINDS,
    BILLING_ERROR_KINDS,
    RECORD_FILES_ERROR_KINDS,
    OBJECT_STORAGE_ERROR_KINDS,
]

/**
 * Registers the mcp app capabilities in their boot order: the platform (the queue capability idle: the outbox a wake's drain job is
 * written to is relayed by the api) with the error and message tables of what it composes, the default-deny identity (it serves no
 * user session: every access token is refused; its one door takes an MCP key, verified by the api-keys capability), the records and
 * knowledge the data ops read, the files and the call log, the capabilities the ops' handlers run on, health and the endpoint. It
 * loads no provider module and no tools module and runs no tool and no graph (`.starciwork/concepts/mcp.md` rule 10): an agent's work
 * is started by a wake the api's engine drains.
 */
export const mcpModules = (options: McpAppOptions): Array<DynamicModule | Type> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [...MCP_BUNDLES],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [...MCP_ERROR_KIND_TABLES],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [options.database],
        entities: PRIMARY_ENTITIES,
        typeParsers: appPgTypes,
    }),
    QueueModule.register({ isGlobal: true, schedulers: [], ...options.queue, enabled: false }),
    RetryModule.register({ isGlobal: true }),
    // The gateway runs no worker and no scheduler; the engine's job runner reads the claims of the jobs table, so the capability is registered idle.
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "mcp",
        leaseMs: 60_000,
        scheduler: { enabled: false },
    }),
    EventsModule.register({ isGlobal: true }),
    ApiKeysModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken: refuseSessions,
        credentialAuthenticator: McpKeyAuthenticatorService,
    }),
    LivenessModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    // The agents in the mode that applies a setup (the module installs of the data ops): the agent texts and lookups, no knowledge
    // lens, dashboard or channel owners.
    AgentsModule.register({
        isGlobal: true,
        setupOnly: true,
        ports: {
            installations: InstallationDirectoryService,
            connections: AgentBindingsService,
            rooms: ChatRoomDirectoryService,
        },
    }),
    InboundEventsModule.register({ isGlobal: true }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    AccountDataModule.withoutPages({ isGlobal: true, types: ACCOUNT_DATA_CATALOG }),
    DataRecordsModule.register({ isGlobal: true }),
    // The people's doors to the workflows (list, whether one can start, the start that writes a wake for the api's engine): no engine.
    AgentGraphsModule.register({ isGlobal: true, doorsOnly: true }),
    ...mcpKnowledgeModules(options),
    // The file ops keep a record's files in the object store and check the plan's storage room (the entitlements alone).
    ObjectStorageModule.register({ isGlobal: true, ...options.storage }),
    BillingModule.registerEntitlements({ isGlobal: true, ...options.billing }),
    RecordFilesModule.register({ isGlobal: true, storage: STORAGE_FILES }),
    // The one call log every op call writes a line to.
    ToolCallLogModule.register({ isGlobal: true }),
    // What the endpoint's data ops run on (the api resolvers' own handlers), registered as the api registers it.
    ...mcpEndpointModules(options),
    SystemHealthHttpModule.register({}),
    // The registry of the data ops and the handlers their features declare, then the outbound MCP surface over them, then its HTTP door.
    ...nivoApiModules(),
    McpEndpointModule.register({ executor: NivoApiExecutorService }),
    McpEndpointHttpModule.register({}),
]
