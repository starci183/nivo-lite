import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LivenessOptions } from "./liveness.options"

/** The configurable-module base of the liveness capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<LivenessOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LivenessOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LivenessOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
