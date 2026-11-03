import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { SepayTransactionsOptions } from "./sepay-transactions.options"

/** The configurable-module base of the sepay-transactions capability. */
const definition = new ConfigurableModuleBuilder<SepayTransactionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    SepayTransactionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: SepayTransactionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
