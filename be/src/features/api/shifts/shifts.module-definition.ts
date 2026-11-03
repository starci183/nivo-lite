import { defineConfigurableModule } from "@starci/nest-kit"
import type { ShiftsApiOptions } from "./shifts.options"

/** The configurable-module base of the shifts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ShiftsApiOptions>()
