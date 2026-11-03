import { defineCapabilityModule } from "@starci/nest-kit"
import type { PromoOptions } from "./promo.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PromoOptions>()
