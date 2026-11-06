import type { DynamicModule, Type } from "@nestjs/common"
import { McpEndpointHttpModule } from "@features/api/mcp-endpoint"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { McpAgentAuthenticatorService } from "@modules/domain/api-credentials"
import {
    CONNECTION_SECRETS_MESSAGES,
    CONNECTION_SECRETS_ERROR_KINDS,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES, AgentGraphsModule } from "@modules/domain/agent-graphs"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { AgentsModule } from "@modules/domain/agents"
import { DataRecordsModule } from "@modules/domain/data-records"
import { ENTITY_ENGINE_ERROR_KINDS, ENTITY_ENGINE_MESSAGES } from "@modules/domain/entity-engine"
import { EventsModule } from "@modules/domain/events"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule, refuseSessions } from "@modules/domain/identity"
import { LivenessModule } from "@modules/domain/liveness"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { McpCallLogModule } from "@modules/domain/mcp-call-log"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS, MCP_GATEWAY_RECEIPTS_MESSAGES } from "@modules/domain/mcp-gateway-receipts"
import { CUSTOMER_TOOL_ADAPTERS, NATIVE_TOOL_ADAPTERS } from "@modules/domain/native-tools"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import { ProviderRegistryModule } from "@modules/domain/provider-registry"
import { SepayProviderModule } from "@modules/domain/sepay-provider"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { appPgTypes } from "@modules/integrations/data-sources"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { SEPAY_ERROR_KINDS, SEPAY_MESSAGES, SepayModule } from "@modules/integrations/sepay"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DatabaseModule } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { QueueModule } from "@modules/platform/queue"
import { RetryModule } from "@modules/platform/retry"
import type { McpAppOptions } from "../mcp.options"
import { entityEngineStoreModules } from "./entity-engine"
import { mcpKnowledgeErrorKinds, mcpKnowledgeMessages, mcpKnowledgeModules } from "./knowledge"

/**
 * Registers the mcp app capabilities in their boot order: the platform (its timer port is the queue capability's, which the
 * readiness probe and the native connectors' deadlines use) with the error and message tables of what it composes, the
 * default-deny identity (it serves no user session: every access token is refused; its one door takes an agent key, verified by
 * the api-keys capability), the read-only readers behind the native tools (the Brain, the dossiers, the providers), the gateway over
 * the primary database with the bank moves it reads and the connection key that opens each remote connector's sealed credential,
 * health and the endpoint.
 */
export const mcpModules = (options: McpAppOptions): Array<DynamicModule | Type> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [
            AGENT_GRAPHS_MESSAGES,
            API_KEYS_MESSAGES,
            CONNECTION_SECRETS_MESSAGES,
            ENTITY_ENGINE_MESSAGES,
            ERRORS_MESSAGES,
            HTTP_SECURITY_MESSAGES,
            IDENTITY_MESSAGES,
            ...mcpKnowledgeMessages,
            MCP_GATEWAY_MESSAGES,
            MCP_GATEWAY_RECEIPTS_MESSAGES,
            MCP_MESSAGES,
            SEPAY_MESSAGES,
            TRANSACTIONS_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            AGENT_GRAPHS_ERROR_KINDS,
            API_KEYS_ERROR_KINDS,
            CONFIG_ERROR_KINDS,
            CONNECTION_SECRETS_ERROR_KINDS,
            ENTITY_ENGINE_ERROR_KINDS,
            HTTP_SECURITY_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            ...mcpKnowledgeErrorKinds,
            MCP_GATEWAY_ERROR_KINDS,
            MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
            MCP_ERROR_KINDS,
            SEPAY_ERROR_KINDS,
            TRANSACTIONS_ERROR_KINDS,
        ],
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
    EventsModule.register({ isGlobal: true }),
    ApiKeysModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken: refuseSessions,
        credentialAuthenticator: McpAgentAuthenticatorService,
    }),
    LivenessModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    InboundEventsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    DataRecordsModule.register({ isGlobal: true }),
    ...entityEngineStoreModules(options),
    AgentGraphsModule.register({ isGlobal: true, rightsOnly: true }),
    ...mcpKnowledgeModules(options),
    ProviderRegistryModule.register({ isGlobal: true }),
    SepayModule.register({ isGlobal: true, ...options.sepay }),
    SepayProviderModule.register({ isGlobal: true }),
    McpCallLogModule.register({ isGlobal: true }),
    McpGatewayModule.register({
        isGlobal: true,
        ...options.mcpGateway,
        keyCheck: true,
        natives: [...NATIVE_TOOL_ADAPTERS, ...CUSTOMER_TOOL_ADAPTERS],
    }),
    SystemHealthHttpModule.register({}),
    McpEndpointHttpModule.register({}),
]
