import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionsOptions } from "./connections.options"

/** The configurable-module base of the connections capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionsOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
