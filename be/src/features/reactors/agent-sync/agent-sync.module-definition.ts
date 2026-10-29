import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentSyncOptions } from "./agent-sync.options"

/** The configurable-module base of the agent-sync module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentSyncOptions>().setClassMethodName("register").build()
