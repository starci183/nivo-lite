import { defineConfigurableModule } from "@starci/nest-kit"
import type { PollDueConnectionsQueueOptions } from "./poll-due-connections-queue.options"

/** The configurable-module base of the poll-due-connections-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PollDueConnectionsQueueOptions>()
