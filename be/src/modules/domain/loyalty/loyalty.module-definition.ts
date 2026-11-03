import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyOptions } from "./loyalty.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyOptions>()
