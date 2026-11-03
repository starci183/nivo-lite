import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunMarketingTickQueueOptions } from "./run-marketing-tick-queue.options"

/** The configurable-module base of the run-marketing-tick-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunMarketingTickQueueOptions>()
