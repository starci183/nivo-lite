import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataHubOptions } from "./data-hub.options"

/** The configurable-module base of the data-hub capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataHubOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
