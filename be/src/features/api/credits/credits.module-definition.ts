import { defineConfigurableModule } from "@starci/nest-kit"
import type { CreditsApiOptions } from "./credits.options"

/** The configurable-module base of the credits module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CreditsApiOptions>()
