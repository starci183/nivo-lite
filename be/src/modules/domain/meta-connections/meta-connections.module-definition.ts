import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaConnectionsOptions } from "./meta-connections.options"

/** The configurable-module base of the meta-connections capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MetaConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
