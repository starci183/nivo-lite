import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SweepAgentWorkOptions } from "./sweep-agent-work.options"

/** The configurable-module base of the sweep-agent-work module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SweepAgentWorkOptions>().setClassMethodName("register").build()
