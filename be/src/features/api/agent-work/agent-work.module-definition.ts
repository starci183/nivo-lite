import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentWorkApiOptions } from "./agent-work.options"

type Host = ConfigurableModuleHost<AgentWorkApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentWorkApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the agent-work feature module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-work feature module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-work feature module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
