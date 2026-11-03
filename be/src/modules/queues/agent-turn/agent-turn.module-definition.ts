import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentTurnOptions } from "./agent-turn.options"

/** The configurable-module base of the agent-turn queue module. */
const definition = new ConfigurableModuleBuilder<AgentTurnOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<AgentTurnOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: AgentTurnOptions = definition.OPTIONS_TYPE
