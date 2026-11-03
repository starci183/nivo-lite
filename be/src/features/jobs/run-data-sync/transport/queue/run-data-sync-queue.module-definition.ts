import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunDataSyncQueueOptions } from "./run-data-sync-queue.options"

type Host = ConfigurableModuleHost<RunDataSyncQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunDataSyncQueueOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-data-sync-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-data-sync-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-data-sync-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
