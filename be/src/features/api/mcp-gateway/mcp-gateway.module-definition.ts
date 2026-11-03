import { defineConfigurableModule } from "@starci/nest-kit"
import type { McpGatewayApiOptions } from "./mcp-gateway.options"

/** The configurable-module base of the MCP gateway console module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<McpGatewayApiOptions>()
