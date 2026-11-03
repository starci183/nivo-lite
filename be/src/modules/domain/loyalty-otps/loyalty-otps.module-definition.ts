import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyOtpsOptions } from "./loyalty-otps.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyOtpsOptions>()
