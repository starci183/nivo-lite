import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyOptions } from "./loyalty.options"

/** The configurable-module base of the loyalty capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
