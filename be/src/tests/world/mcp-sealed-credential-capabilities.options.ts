import { AgentsModule } from "@modules/domain/agents"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { EventsModule } from "@modules/domain/events"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS, MCP_GATEWAY_RECEIPTS_MESSAGES } from "@modules/domain/mcp-gateway-receipts"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import { QUEUE_MODULES } from "./test-capabilities.options"

/** The connection key of the sealed-credential proofs: a local test key of their own, never a deployed one. */
export const SEALED_PROOF_TOKEN_KEY = new Secret(Buffer.alloc(32, 13).toString("base64"))

/**
 * The gateway as the api composes it for the console: the real connection key cipher (connection-secrets), the connections
 * capability that authorizes owners and managers, and the gateway with its admin service, over the local database.
 */
export const MCP_SEALED_CREDENTIAL_MODULES = [
    I18nModule.register({
        isGlobal: true,
        bundles: [
            CONNECTION_SECRETS_MESSAGES,
            CONNECTIONS_MESSAGES,
            ERRORS_MESSAGES,
            MCP_GATEWAY_MESSAGES,
            MCP_GATEWAY_RECEIPTS_MESSAGES,
            MCP_MESSAGES,
            TRANSACTIONS_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            CONNECTION_SECRETS_ERROR_KINDS,
            CONNECTIONS_ERROR_KINDS,
            MCP_GATEWAY_ERROR_KINDS,
            MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
            MCP_ERROR_KINDS,
            TRANSACTIONS_ERROR_KINDS,
        ],
    }),
    ...QUEUE_MODULES,
    EventsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: SEALED_PROOF_TOKEN_KEY }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: SEALED_PROOF_TOKEN_KEY,
        siteUrl: "http://localhost:3000",
        publicSiteUrl: undefined,
    }),
    McpGatewayModule.register({
        isGlobal: true,
        remote: { clientName: "nivo-mcp-gateway" },
        defaultTimeoutMs: 4000,
        console: true,
    }),
]
