import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionGrantsOptions } from "./connection-grants.options"

/** The configurable-module base of the connection-grants capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConnectionGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
