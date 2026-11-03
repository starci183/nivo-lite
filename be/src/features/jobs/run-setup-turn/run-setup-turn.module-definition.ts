import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunSetupTurnOptions } from "./run-setup-turn.options"

/** The configurable-module base of the run-setup-turn module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunSetupTurnOptions>()
