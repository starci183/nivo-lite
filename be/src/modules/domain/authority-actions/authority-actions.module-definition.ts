import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AuthorityActionsOptions } from "./authority-actions.options"

/** The configurable-module base of the authority actions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AuthorityActionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
