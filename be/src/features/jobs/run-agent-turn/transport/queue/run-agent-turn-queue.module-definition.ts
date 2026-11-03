import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunAgentTurnQueueOptions } from "./run-agent-turn-queue.options"

/** The configurable-module base of the run-agent-turn-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunAgentTurnQueueOptions>()
