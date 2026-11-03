import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { McpEndpointOptions } from "./mcp-endpoint.options"

type Host = ConfigurableModuleHost<McpEndpointOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<McpEndpointOptions>().setClassMethodName("register").build()

/** The configurable-module base of the MCP endpoint feature (its handlers). */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the MCP endpoint feature (its handlers). */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the MCP endpoint feature (its handlers). */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
