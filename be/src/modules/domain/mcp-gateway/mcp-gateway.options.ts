import type { McpOptions } from "@modules/integrations/mcp"

/** What the gateway needs: the MCP integration's credentials (by NAME), the default time limit of a call, and the console flag. */
export interface McpGatewayOptions {
    /** The MCP integration options: the credential secrets remote connectors may name, each read through `<NAME>_FILE`. */
    readonly remote: McpOptions
    /** True in the app that serves the console (registers the admin service, which needs the connections capability). */
    readonly console?: boolean
    /** The time limit of one call, milliseconds (4 s). */
    readonly defaultTimeoutMs: number
}
