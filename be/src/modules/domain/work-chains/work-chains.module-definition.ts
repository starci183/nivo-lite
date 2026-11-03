import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkChainsOptions } from "./work-chains.options"

/** The configurable-module base of the work-chains capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<WorkChainsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkChainsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkChainsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
