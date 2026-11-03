import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAutomationTickQueueOptions } from "./run-automation-tick-queue.options"

/** The configurable-module base of the run-automation-tick-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAutomationTickQueueOptions>()
