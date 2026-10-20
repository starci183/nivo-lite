import type { Secret } from "@modules/platform/config"

/** What the gateway needs: the credentials remote connectors may name, and the default time limit of a call. */
export interface McpGatewayOptions {
    /** The credential secrets by NAME (`credential_ref`), each read through `<NAME>_FILE`; values never leave the gateway. */
    readonly credentials: ReadonlyMap<string, Secret>
    /** The bearer agents present on the gateway's own MCP endpoint (MCP_GATEWAY_AGENT_TOKEN_FILE), or null to keep it closed. */
    readonly agentToken: Secret | null
    /** True in the app that serves the console (registers the admin service, which needs the connections capability). */
    readonly console?: boolean
    /** The time limit of one call, milliseconds (4 s). */
    readonly defaultTimeoutMs: number
}
