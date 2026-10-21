import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpEndpointOptions } from "./mcp-endpoint.options"

/** The configurable-module base of the MCP endpoint feature (its handlers). */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<McpEndpointOptions>().setClassMethodName("register").build()
