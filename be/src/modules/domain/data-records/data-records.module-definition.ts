import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DataRecordsOptions } from "./data-records.options"

/** The configurable-module base of the data-records capability. */
const definition = new ConfigurableModuleBuilder<DataRecordsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DataRecordsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DataRecordsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
