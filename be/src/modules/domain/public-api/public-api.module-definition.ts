import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PublicApiOptions } from "./public-api.options"

/** The configurable-module base of the public-api capability. */
const definition = new ConfigurableModuleBuilder<PublicApiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PublicApiOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PublicApiOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
