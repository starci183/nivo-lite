import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyRewardsOptions } from "./loyalty-rewards.options"

/** The configurable-module base of the loyalty-rewards capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyRewardsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
