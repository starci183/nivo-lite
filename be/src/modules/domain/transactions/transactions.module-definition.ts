import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { TransactionsOptions } from "./transactions.options"

/** The configurable-module base of the transactions capability. */
const definition = new ConfigurableModuleBuilder<TransactionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    TransactionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: TransactionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
