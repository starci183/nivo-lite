import { defineConfigurableModule } from "@starci/nest-kit"
import type { VectorSyncQueueOptions } from "./vector-sync.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VectorSyncQueueOptions>()
