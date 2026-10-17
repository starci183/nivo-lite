import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunBrainCommandOptions } from "./run-brain-command.options"

/** The configurable-module base of the run-brain-command module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunBrainCommandOptions>().setClassMethodName("register").build()
