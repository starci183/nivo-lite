import { defineConfigurableModule } from "@starci/nest-kit"
import type { McpEndpointOptions } from "./mcp-endpoint.options"

/** The configurable-module base of the MCP endpoint feature (its handlers). */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<McpEndpointOptions>()
