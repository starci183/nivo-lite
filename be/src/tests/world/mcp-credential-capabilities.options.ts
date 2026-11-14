import { McpKeyAuthenticatorService } from "@modules/domain/api-credentials"
import { AgentsModule } from "@modules/domain/agents"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { EventsModule } from "@modules/domain/events"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule, refuseSessions } from "@modules/domain/identity"
import { ToolCallLogModule } from "@modules/domain/tool-call-log"
import { TOOLS_ERROR_KINDS, TOOLS_MESSAGES, ToolsModule } from "@modules/domain/tools"
import { TOOL_RECEIPTS_ERROR_KINDS, TOOL_RECEIPTS_MESSAGES } from "@modules/domain/tool-receipts"
import { DataRecordsModule } from "@modules/domain/data-records"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobsModule } from "@modules/platform/jobs"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { MCP_ENDPOINT_ERROR_KINDS, MCP_ENDPOINT_MESSAGES, McpEndpointModule } from "@modules/domain/mcp-endpoint"
import { NoDataOpsExecutor } from "../fixtures/builders/mcp-endpoint.builder"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { Secret } from "@modules/platform/config"
import { I18nModule } from "@modules/platform/i18n"
import { QUEUE_MODULES } from "./test-capabilities.options"
import type { DynamicModule } from "@nestjs/common"
import { INSTALLED } from "@modules/domain/installed-plugins"

/** The connection key of the mcp proofs: a local test key of their own, never a deployed one. */
export const MCP_PROOF_TOKEN_KEY: Secret = new Secret(Buffer.alloc(32, 11).toString("base64"))

/** The mcp app's credential composition: no user session, the agent key verified by api-keys, the connection key of the sealed connector credentials. */
export const MCP_CREDENTIAL_MODULES: Array<DynamicModule> = [
    I18nModule.register({
        isGlobal: true,
        bundles: [
            API_KEYS_MESSAGES,
            CONNECTION_SECRETS_MESSAGES,
            ERRORS_MESSAGES,
            IDENTITY_MESSAGES,
            TOOLS_MESSAGES,
            TOOL_RECEIPTS_MESSAGES,
            MCP_ENDPOINT_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            API_KEYS_ERROR_KINDS,
            CONNECTION_SECRETS_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            TOOLS_ERROR_KINDS,
            TOOL_RECEIPTS_ERROR_KINDS,
            MCP_ENDPOINT_ERROR_KINDS,
        ],
    }),
    ...QUEUE_MODULES,
    EventsModule.register({ isGlobal: true }),
    ApiKeysModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken: refuseSessions,
        credentialAuthenticator: McpKeyAuthenticatorService,
    }),
    DataRecordsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "proof",
        leaseMs: 1000,
        scheduler: { enabled: false },
    }),
    EntityEngineModule.register({
        isGlobal: true,
        alerts: ReadOnlyEngineAlertsService,
        entities: INSTALLED.entities(),
        jobs: [],
        cursorKey: MCP_PROOF_TOKEN_KEY,
    }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: MCP_PROOF_TOKEN_KEY }),
    ToolCallLogModule.register({ isGlobal: true }),
    ToolsModule.register({ isGlobal: true, defaultTimeoutMs: 4000 }),
    McpEndpointModule.register({ executor: NoDataOpsExecutor }),
]
