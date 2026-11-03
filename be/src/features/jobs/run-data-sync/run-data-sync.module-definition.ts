import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunDataSyncOptions } from "./run-data-sync.options"

/** The configurable-module base of the run-data-sync module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunDataSyncOptions>()
