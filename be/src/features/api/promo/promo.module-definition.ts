import { defineConfigurableModule } from "@starci/nest-kit"
import type { PromoApiOptions } from "./promo.options"

/** The configurable-module base of the promo module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PromoApiOptions>()
