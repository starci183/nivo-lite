import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyRewardsOptions } from "./loyalty-rewards.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyRewardsOptions>()
