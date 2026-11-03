import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicLoyaltyApiOptions } from "./public-loyalty.options"

/** The configurable-module base of the public-loyalty module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicLoyaltyApiOptions>()
