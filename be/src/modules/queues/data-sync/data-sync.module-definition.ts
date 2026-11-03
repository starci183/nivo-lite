import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DataSyncOptions } from "./data-sync.options"

/** The configurable-module base of the data-sync module. */
const definition = new ConfigurableModuleBuilder<DataSyncOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<DataSyncOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DataSyncOptions = definition.OPTIONS_TYPE
