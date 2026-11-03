import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { McpEndpointHttpOptions } from "./mcp-endpoint-http.options"

type Host = ConfigurableModuleHost<McpEndpointHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<McpEndpointHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the MCP endpoint HTTP module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the MCP endpoint HTTP module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the MCP endpoint HTTP module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
