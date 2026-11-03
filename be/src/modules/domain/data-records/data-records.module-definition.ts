import { defineCapabilityModule } from "@starci/nest-kit"
import type { DataRecordsOptions } from "./data-records.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<DataRecordsOptions>()
