import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepAgentWorkQueueOptions } from "./sweep-agent-work-queue.options"

/** The configurable-module base of the sweep-agent-work-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepAgentWorkQueueOptions>()
