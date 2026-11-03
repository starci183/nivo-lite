import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AccountingOptions } from "./accounting.options"

/** The configurable module base of the accounting capability. */
const definition = new ConfigurableModuleBuilder<AccountingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AccountingOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AccountingOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
