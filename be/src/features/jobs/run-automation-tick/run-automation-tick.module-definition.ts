import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAutomationTickOptions } from "./run-automation-tick.options"

/** The configurable-module base of the run-automation-tick module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAutomationTickOptions>().setClassMethodName("register").build()
