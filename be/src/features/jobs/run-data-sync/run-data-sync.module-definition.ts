import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunDataSyncOptions } from "./run-data-sync.options"

/** The configurable-module base of the run-data-sync module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunDataSyncOptions>().setClassMethodName("register").build()
