import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpGatewayApiOptions } from "./mcp-gateway.options"

/** The configurable-module base of the MCP gateway console module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<McpGatewayApiOptions>().setClassMethodName("register").build()
