import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountingOptions } from "./accounting.options"

/** The configurable module base of the accounting capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
