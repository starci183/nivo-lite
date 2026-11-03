import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { WatchAgentGraphsOptions } from "./watch-agent-graphs.options"

type Host = ConfigurableModuleHost<WatchAgentGraphsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<WatchAgentGraphsOptions>().setClassMethodName("register").build()

/** The configurable-module base of the watch-agent-graphs module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the watch-agent-graphs module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the watch-agent-graphs module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
