import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunAutomationCommandOptions } from "./run-automation-command.options"

/** The configurable-module base of the run-automation-command module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunAutomationCommandOptions>().setClassMethodName("register").build()
