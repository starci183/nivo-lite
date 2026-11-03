import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAccountingMorningQueueOptions } from "./run-accounting-morning-queue.options"

/** The configurable-module base of the run-accounting-morning-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAccountingMorningQueueOptions>()
