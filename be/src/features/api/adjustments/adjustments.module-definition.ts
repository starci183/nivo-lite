import { defineConfigurableModule } from "@starci/nest-kit"
import type { AdjustmentsApiOptions } from "./adjustments.options"

/** The configurable-module base of the adjustments module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AdjustmentsApiOptions>()
