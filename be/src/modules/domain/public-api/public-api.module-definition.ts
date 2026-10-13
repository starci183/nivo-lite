import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicApiOptions } from "./public-api.options"

/** The configurable-module base of the public-api capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PublicApiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
