import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { HttpOptions } from "./http.options"

/** The configurable-module base of the http capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<HttpOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    HttpOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: HttpOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
