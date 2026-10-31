import type { Type } from "@nestjs/common"
import type { McpOptions } from "@modules/integrations/mcp"
import type { NativeAdapter } from "./mcp-gateway.contracts"

/** What the gateway needs: the MCP integration's options, the default time limit of a call and the console flag. */
export interface McpGatewayOptions {
    /** The MCP integration options (the client name announced to remote servers). */
    readonly remote: McpOptions
    /** True in the app that serves the console (registers the admin service, which needs the connections capability). */
    readonly console?: boolean
    /**
     * True in the apps that serve (api, mcp): before serving, the connection key must open what is already sealed with it, else the
     * start fails with CONNECTION_SECRETS_KEY_MISMATCH (needs the connection-secrets capability registered globally).
     */
    readonly keyCheck?: boolean
    /**
     * The native adapter classes the app adds to the gateway's own (SePay, e-invoice). Each is a provider of a global module of the
     * app; the gateway injects them from the global container. The cli passes none.
     */
    readonly natives?: ReadonlyArray<Type<NativeAdapter>>
    /** The time limit of one call, milliseconds (4 s). */
    readonly defaultTimeoutMs: number
}
