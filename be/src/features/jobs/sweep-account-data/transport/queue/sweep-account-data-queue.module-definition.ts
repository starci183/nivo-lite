import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepAccountDataQueueOptions } from "./sweep-account-data-queue.options"

/** The configurable-module base of the sweep-account-data-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepAccountDataQueueOptions>()
