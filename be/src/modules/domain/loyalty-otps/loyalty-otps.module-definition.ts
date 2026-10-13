import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyOtpsOptions } from "./loyalty-otps.options"

/** The configurable-module base of the loyalty one-time codes capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyOtpsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
