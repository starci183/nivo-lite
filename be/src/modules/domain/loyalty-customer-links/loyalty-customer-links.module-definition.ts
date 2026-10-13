import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyCustomerLinksOptions } from "./loyalty-customer-links.options"

/** The configurable-module base of the loyalty-customer-links capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyCustomerLinksOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
