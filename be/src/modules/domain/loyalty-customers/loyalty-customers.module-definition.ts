import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyCustomersOptions } from "./loyalty-customers.options"

/** The configurable-module base of the loyalty-customers capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyCustomersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
