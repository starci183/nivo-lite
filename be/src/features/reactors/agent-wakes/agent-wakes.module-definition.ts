import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentWakesOptions } from "./agent-wakes.options"

type Host = ConfigurableModuleHost<AgentWakesOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentWakesOptions>().setClassMethodName("register").build()

/** The configurable-module base of the agent-wakes module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-wakes module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-wakes module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
