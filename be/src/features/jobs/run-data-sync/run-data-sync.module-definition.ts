import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunDataSyncOptions } from "./run-data-sync.options"

type Host = ConfigurableModuleHost<RunDataSyncOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunDataSyncOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-data-sync module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-data-sync module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-data-sync module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
