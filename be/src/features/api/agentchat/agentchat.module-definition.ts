import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentchatApiOptions } from "./agentchat.options"

/** The configurable-module base of the agentchat module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AgentchatApiOptions>().setClassMethodName("register").build()
