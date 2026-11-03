import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunDataSyncQueueOptions } from "./run-data-sync-queue.options"

/** The configurable-module base of the run-data-sync-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunDataSyncQueueOptions>()
