import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CreditsOptions } from "./credits.options"

/** The configurable-module base of the credits capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CreditsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
