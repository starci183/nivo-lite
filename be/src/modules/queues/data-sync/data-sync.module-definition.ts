import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataSyncOptions } from "./data-sync.options"

/** The configurable-module base of the data-sync module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataSyncOptions>().setClassMethodName("register").build()
