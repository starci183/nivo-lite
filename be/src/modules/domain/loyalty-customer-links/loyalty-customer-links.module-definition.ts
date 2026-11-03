import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyCustomerLinksOptions } from "./loyalty-customer-links.options"

/** The configurable-module base of the loyalty-customer-links capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyCustomerLinksOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyCustomerLinksOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyCustomerLinksOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
