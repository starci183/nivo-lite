import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WatchAgentGraphsQueueOptions } from "./watch-agent-graphs-queue.options"

/** The configurable-module base of the watch-agent-graphs-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WatchAgentGraphsQueueOptions>().setClassMethodName("register").build()
