import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunDataSyncQueueOptions } from "./run-data-sync-queue.options"

/** The configurable-module base of the run-data-sync-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunDataSyncQueueOptions>().setClassMethodName("register").build()
