import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkPerformersOptions } from "./work-performers.options"

/** The configurable-module base of the work-performers capability. */
const definition = new ConfigurableModuleBuilder<WorkPerformersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkPerformersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkPerformersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
