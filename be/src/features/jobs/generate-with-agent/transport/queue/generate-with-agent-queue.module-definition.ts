import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GenerateWithAgentQueueOptions } from "./generate-with-agent-queue.options"

/** The configurable-module base of the generate-with-agent-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GenerateWithAgentQueueOptions>().setClassMethodName("register").build()
