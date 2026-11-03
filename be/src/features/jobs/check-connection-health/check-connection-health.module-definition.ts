import { defineConfigurableModule } from "@starci/nest-kit"
import type { CheckConnectionHealthOptions } from "./check-connection-health.options"

/** The configurable-module base of the check-connection-health module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CheckConnectionHealthOptions>()
