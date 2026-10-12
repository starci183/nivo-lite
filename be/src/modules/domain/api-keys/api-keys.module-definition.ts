import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ApiKeysOptions } from "./api-keys.options"

/** The configurable-module base of the api-keys capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ApiKeysOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
