import { defineConfigurableModule } from "@starci/nest-kit"
import type { SyncAgentsQueueOptions } from "./sync-agents-queue.options"

/** The configurable-module base of the sync-agents-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SyncAgentsQueueOptions>()
