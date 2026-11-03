import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AccountingAdjustmentsOptions } from "./accounting-adjustments.options"

/** The configurable module base of the adjustments capability. */
const definition = new ConfigurableModuleBuilder<AccountingAdjustmentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AccountingAdjustmentsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AccountingAdjustmentsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
