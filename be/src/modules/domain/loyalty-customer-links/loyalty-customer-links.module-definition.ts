import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyCustomerLinksOptions } from "./loyalty-customer-links.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyCustomerLinksOptions>()
