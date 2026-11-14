import { defineCapabilityModule } from "@starci/nest-kit"
import type { ProviderOfferOptions } from "./provider-offer.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ProviderOfferOptions>()
