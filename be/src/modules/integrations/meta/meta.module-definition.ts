import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"

/** The configurable-module base of the meta integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<MetaOptions>({
    optionsInjectionToken: META_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MetaOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: MetaOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
