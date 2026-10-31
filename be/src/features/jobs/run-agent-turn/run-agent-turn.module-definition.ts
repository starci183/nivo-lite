import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAgentTurnOptions } from "./run-agent-turn.options"

/** The configurable-module base of the run-agent-turn module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAgentTurnOptions>().setClassMethodName("register").build()
