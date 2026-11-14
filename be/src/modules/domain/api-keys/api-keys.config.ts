import type { EnvSource } from "@modules/platform/config"
import type { ApiKeysOptions } from "./api-keys.options"

/** Reads the api-keys keys: the optional public base URL of the mcp app (`MCP_PUBLIC_URL`, an absolute URL when declared). */
export const parseApiKeysConfig = (env: EnvSource): ApiKeysOptions => ({
    mcpPublicUrl: env.has("MCP_PUBLIC_URL") ? env.url("MCP_PUBLIC_URL") : undefined,
})
