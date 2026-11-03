import { defineConfigurableModule } from "@starci/nest-kit"
import type { LoyaltyTillHttpOptions } from "./loyalty-till-http.options"

/** The configurable-module base of the loyalty-till-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LoyaltyTillHttpOptions>()
