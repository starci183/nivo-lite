import { McpAgentAuthenticatorService } from "@modules/domain/api-credentials"
import { AgentsModule } from "@modules/domain/agents"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { EventsModule } from "@modules/domain/events"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule, refuseSessions } from "@modules/domain/identity"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS, MCP_GATEWAY_RECEIPTS_MESSAGES } from "@modules/domain/mcp-gateway-receipts"
import { DataRecordsModule } from "@modules/domain/data-records"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { Secret } from "@modules/platform/config"
import { I18nModule } from "@modules/platform/i18n"
import { QUEUE_MODULES } from "./test-capabilities.options"

/** The connection key of the mcp proofs: a local test key of their own, never a deployed one. */
export const MCP_PROOF_TOKEN_KEY = new Secret(Buffer.alloc(32, 11).toString("base64"))

/** The mcp app's credential composition: no user session, the agent key verified by api-keys, the connection key of the sealed connector credentials. */
export const MCP_CREDENTIAL_MODULES = [
    I18nModule.register({
        isGlobal: true,
        bundles: [
            API_KEYS_MESSAGES,
            CONNECTION_SECRETS_MESSAGES,
            ERRORS_MESSAGES,
            IDENTITY_MESSAGES,
            MCP_GATEWAY_MESSAGES,
            MCP_GATEWAY_RECEIPTS_MESSAGES,
            MCP_MESSAGES,
            TRANSACTIONS_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            API_KEYS_ERROR_KINDS,
            CONNECTION_SECRETS_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            MCP_GATEWAY_ERROR_KINDS,
            MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
            MCP_ERROR_KINDS,
            TRANSACTIONS_ERROR_KINDS,
        ],
    }),
    ...QUEUE_MODULES,
    EventsModule.register({ isGlobal: true }),
    ApiKeysModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken: refuseSessions,
        credentialAuthenticator: McpAgentAuthenticatorService,
    }),
    DataRecordsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: MCP_PROOF_TOKEN_KEY }),
    McpGatewayModule.register({ isGlobal: true, remote: { clientName: "nivo-mcp-gateway" }, defaultTimeoutMs: 4000 }),
]
