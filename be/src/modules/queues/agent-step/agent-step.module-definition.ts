import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentStepOptions } from "./agent-step.options"

/** The configurable-module base of the agent-step queue module. */
const definition = new ConfigurableModuleBuilder<AgentStepOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<AgentStepOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: AgentStepOptions = definition.OPTIONS_TYPE
