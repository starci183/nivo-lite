import { defineConfigurableModule } from "@starci/nest-kit"
import type { DataSyncOptions } from "./data-sync.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DataSyncOptions>()
