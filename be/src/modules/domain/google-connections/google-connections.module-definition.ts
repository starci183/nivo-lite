import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GoogleConnectionsOptions } from "./google-connections.options"

/** The configurable-module base of the google-connections capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<GoogleConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
