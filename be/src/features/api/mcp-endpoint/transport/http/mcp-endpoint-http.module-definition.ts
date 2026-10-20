import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpEndpointHttpOptions } from "./mcp-endpoint-http.options"

/** The configurable-module base of the MCP endpoint HTTP module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<McpEndpointHttpOptions>().setClassMethodName("register").build()
