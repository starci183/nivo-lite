import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ApiKeysOptions } from "./api-keys.options"

/** The configurable-module base of the api-keys capability. */
const definition = new ConfigurableModuleBuilder<ApiKeysOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ApiKeysOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ApiKeysOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
