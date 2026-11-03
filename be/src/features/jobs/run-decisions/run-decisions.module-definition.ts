import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunDecisionsOptions } from "./run-decisions.options"

/** The configurable-module base of the run-decisions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunDecisionsOptions>()
