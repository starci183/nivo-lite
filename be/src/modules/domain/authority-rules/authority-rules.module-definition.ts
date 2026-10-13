import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AuthorityRulesOptions } from "./authority-rules.options"

/** The configurable-module base of the authority-rules capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AuthorityRulesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
