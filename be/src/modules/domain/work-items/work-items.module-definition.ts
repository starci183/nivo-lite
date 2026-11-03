import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkItemsOptions } from "./work-items.options"

/** The configurable-module base of the work items capability. */
const definition = new ConfigurableModuleBuilder<WorkItemsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkItemsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkItemsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
