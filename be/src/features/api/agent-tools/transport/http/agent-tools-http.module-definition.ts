import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentToolsHttpOptions } from "./agent-tools-http.options"

type Host = ConfigurableModuleHost<AgentToolsHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentToolsHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the agent-tools-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-tools-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-tools-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
