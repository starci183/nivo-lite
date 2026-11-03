import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentWakesMessageOptions } from "./agent-wakes-message.options"

type Host = ConfigurableModuleHost<AgentWakesMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentWakesMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the agent-wakes-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-wakes-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-wakes-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
