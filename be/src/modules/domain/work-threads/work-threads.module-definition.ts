import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkThreadsOptions } from "./work-threads.options"

/** The configurable-module base of the work-threads capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<WorkThreadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkThreadsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkThreadsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
