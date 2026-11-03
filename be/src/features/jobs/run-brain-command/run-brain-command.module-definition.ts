import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunBrainCommandOptions } from "./run-brain-command.options"

/** The configurable-module base of the run-brain-command module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunBrainCommandOptions>()
