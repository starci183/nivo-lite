import { McpAgentAuthenticatorService } from "@modules/domain/api-credentials"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { EventsModule } from "@modules/domain/events"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { refuseSupabaseSessions } from "@modules/integrations/supabase"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import { QUEUE_MODULES } from "./test-capabilities.options"

/** The mcp app's credential composition: no user session, the agent key verified by api-keys. */
export const MCP_CREDENTIAL_MODULES = [
    I18nModule.register({
        isGlobal: true,
        bundles: [
            API_KEYS_MESSAGES,
            ERRORS_MESSAGES,
            IDENTITY_MESSAGES,
            MCP_GATEWAY_MESSAGES,
            MCP_MESSAGES,
            TRANSACTIONS_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            API_KEYS_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            MCP_GATEWAY_ERROR_KINDS,
            MCP_ERROR_KINDS,
            TRANSACTIONS_ERROR_KINDS,
        ],
    }),
    ...QUEUE_MODULES,
    EventsModule.register({ isGlobal: true }),
    ApiKeysModule.register({ isGlobal: true }),
    IdentityModule.register({
        isGlobal: true,
        verifyAccessToken: refuseSupabaseSessions,
        credentialAuthenticator: McpAgentAuthenticatorService,
    }),
    TransactionsModule.register({ isGlobal: true }),
    McpGatewayModule.register({ isGlobal: true, remote: { credentials: new Map() }, defaultTimeoutMs: 4000 }),
]
