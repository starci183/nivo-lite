import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyCustomersOptions } from "./loyalty-customers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyCustomersOptions>()
