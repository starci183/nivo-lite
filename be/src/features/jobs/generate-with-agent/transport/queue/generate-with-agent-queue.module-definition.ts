import { defineConfigurableModule } from "@starci/nest-kit"
import type { GenerateWithAgentQueueOptions } from "./generate-with-agent-queue.options"

/** The configurable-module base of the generate-with-agent-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<GenerateWithAgentQueueOptions>()
