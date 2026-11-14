import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepAccountDataOptions } from "./sweep-account-data.options"

/** The configurable-module base of the sweep-account-data module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepAccountDataOptions>()
