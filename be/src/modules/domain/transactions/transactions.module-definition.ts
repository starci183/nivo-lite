import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TransactionsOptions } from "./transactions.options"

/** The configurable-module base of the transactions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TransactionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
