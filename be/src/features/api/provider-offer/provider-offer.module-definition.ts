import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProviderOfferApiOptions } from "./provider-offer.options"

/** The configurable-module base of the provider offer module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProviderOfferApiOptions>()
