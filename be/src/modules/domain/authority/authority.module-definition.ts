import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AuthorityOptions } from "./authority.options"

/** The configurable-module base of the authority capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AuthorityOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
