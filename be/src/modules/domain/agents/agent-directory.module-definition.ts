import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentDirectoryOptions } from "./agent-directory.options"

/** The configurable-module base of the agent directory sub-module. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<AgentDirectoryOptions>()
    .setClassMethodName("register")
    .build()
