import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepSystemHistoryQueueOptions } from "./sweep-system-history-queue.options"

/** The configurable-module base of the sweep-system-history-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepSystemHistoryQueueOptions>()
