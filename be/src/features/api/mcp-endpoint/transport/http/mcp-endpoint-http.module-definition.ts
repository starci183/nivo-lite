import { defineConfigurableModule } from "@starci/nest-kit"
import type { McpEndpointHttpOptions } from "./mcp-endpoint-http.options"

/** The configurable-module base of the MCP endpoint HTTP module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<McpEndpointHttpOptions>()
