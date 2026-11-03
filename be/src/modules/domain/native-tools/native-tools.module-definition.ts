import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { NativeToolsOptions } from "./native-tools.options"

/** The configurable-module base of the native-tools capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<NativeToolsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    NativeToolsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: NativeToolsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
