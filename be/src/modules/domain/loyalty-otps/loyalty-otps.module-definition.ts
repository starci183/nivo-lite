import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyOtpsOptions } from "./loyalty-otps.options"

/** The configurable-module base of the loyalty one-time codes capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyOtpsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyOtpsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyOtpsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
