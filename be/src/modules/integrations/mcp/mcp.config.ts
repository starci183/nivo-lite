import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import type { McpOptions } from "./mcp.options"

const NAME = /^[A-Z][A-Z0-9_]{2,80}$/u

/**
 * Reads the credentials remote MCP servers accept: `MCP_GATEWAY_CREDENTIALS` lists their NAMES and each one is read as a
 * secret, so `<NAME>_FILE` mounts it. A listed name without a value is left out, so a connector naming it is refused as missing
 * its credential.
 */
export const parseMcpConfig = (env: EnvSource): McpOptions => {
    const names = (env.optional("MCP_GATEWAY_CREDENTIALS") ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => NAME.test(name))
    return {
        credentials: new Map<string, Secret>(
            names.filter((name) => env.has(name)).map((name) => [name, env.secret(name)]),
        ),
    }
}
