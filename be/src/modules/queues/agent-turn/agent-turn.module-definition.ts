import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentTurnOptions } from "./agent-turn.options"

/** The configurable-module base of the agent-turn queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentTurnOptions>().setClassMethodName("register").build()
