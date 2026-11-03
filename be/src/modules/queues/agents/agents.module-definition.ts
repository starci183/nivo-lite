import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentsQueueOptions } from "./agents.options"

/** The configurable-module base of the agents module. */
const definition = new ConfigurableModuleBuilder<AgentsQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<AgentsQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: AgentsQueueOptions = definition.OPTIONS_TYPE
