import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DataSyncRunsOptions } from "./data-sync-runs.options"

/** The configurable-module base of the data-sync-runs capability. */
const definition = new ConfigurableModuleBuilder<DataSyncRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DataSyncRunsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DataSyncRunsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
