import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataSyncRunsOptions } from "./data-sync-runs.options"

/** The configurable-module base of the data-sync-runs capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataSyncRunsOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
