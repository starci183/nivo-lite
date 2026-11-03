import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyCustomersOptions } from "./loyalty-customers.options"

/** The configurable-module base of the loyalty-customers capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyCustomersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyCustomersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyCustomersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
