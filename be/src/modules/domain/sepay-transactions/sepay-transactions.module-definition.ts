import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayTransactionsOptions } from "./sepay-transactions.options"

/** The configurable-module base of the sepay-transactions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SepayTransactionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
