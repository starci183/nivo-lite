import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAgentStepQueueOptions } from "./run-agent-step-queue.options"

/** The configurable-module base of the run-agent-step-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAgentStepQueueOptions>()
