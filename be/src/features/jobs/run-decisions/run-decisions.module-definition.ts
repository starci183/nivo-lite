import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunDecisionsOptions } from "./run-decisions.options"

/** The configurable-module base of the run-decisions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunDecisionsOptions>().setClassMethodName("register").build()
