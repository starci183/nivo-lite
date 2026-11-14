import { defineConfigurableModule } from "@starci/nest-kit"
import type { SyncVectorsQueueOptions } from "./sync-vectors-queue.options"

/** The configurable-module base of the sync-vectors-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SyncVectorsQueueOptions>()
