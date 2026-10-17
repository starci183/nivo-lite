import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SyncAgentsQueueOptions } from "./sync-agents-queue.options"

/** The configurable-module base of the sync-agents-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SyncAgentsQueueOptions>().setClassMethodName("register").build()
