import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import type { McpGatewayOptions } from "./mcp-gateway.options"

const NAME = /^[A-Z][A-Z0-9_]{2,80}$/u

/**
 * Reads the gateway settings: `MCP_GATEWAY_CREDENTIALS` lists the NAMES remote connectors may reference (for example
 * `MCP_HAKUEN_CLIENT_SECRET`); each one is read as a secret, so `<NAME>_FILE` mounts it. A listed name without a value is left out.
 */
export const parseMcpGatewayConfig = (env: EnvSource): McpGatewayOptions => {
    const names = (env.optional("MCP_GATEWAY_CREDENTIALS") ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => NAME.test(name))
    const credentials = new Map<string, Secret>(
        names.filter((name) => env.has(name)).map((name) => [name, env.secret(name)]),
    )
    return {
        credentials,
        agentToken: env.has("MCP_GATEWAY_AGENT_TOKEN") ? env.secret("MCP_GATEWAY_AGENT_TOKEN") : null,
        defaultTimeoutMs: env.int("MCP_GATEWAY_TIMEOUT_MS", 4000),
    }
}

/** Options without credentials, for apps and specs that run no remote connector. */
export const emptyMcpGatewayOptions = (): McpGatewayOptions => ({
    credentials: new Map<string, Secret>(),
    agentToken: null,
    defaultTimeoutMs: 4000,
})
