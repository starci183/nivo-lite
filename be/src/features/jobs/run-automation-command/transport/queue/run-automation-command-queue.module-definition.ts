import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAutomationCommandQueueOptions } from "./run-automation-command-queue.options"

/** The configurable-module base of the run-automation-command-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAutomationCommandQueueOptions>()
