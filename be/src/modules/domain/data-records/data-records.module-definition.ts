import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DataRecordsOptions } from "./data-records.options"

/** The configurable-module base of the data-records capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataRecordsOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
