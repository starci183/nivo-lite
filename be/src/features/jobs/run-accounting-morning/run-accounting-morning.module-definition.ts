import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAccountingMorningOptions } from "./run-accounting-morning.options"

/** The configurable-module base of the run-accounting-morning module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAccountingMorningOptions>()
