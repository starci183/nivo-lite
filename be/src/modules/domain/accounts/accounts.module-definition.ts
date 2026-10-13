import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountsOptions } from "./accounts.options"

/** The configurable-module base of the accounts capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
