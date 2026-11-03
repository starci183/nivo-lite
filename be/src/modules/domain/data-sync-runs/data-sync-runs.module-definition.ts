import { defineCapabilityModule } from "@starci/nest-kit"
import type { DataSyncRunsOptions } from "./data-sync-runs.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<DataSyncRunsOptions>()
