import { defineConfigurableModule } from "@starci/nest-kit"
import type { AutomationsApiOptions } from "./automations.options"

/** The configurable-module base of the automations module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AutomationsApiOptions>()
