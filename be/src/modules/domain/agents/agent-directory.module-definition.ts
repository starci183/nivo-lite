import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AgentDirectoryOptions } from "./agent-directory.options"

/** The configurable-module base of the agent directory; the app root decides whether it is global. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<AgentDirectoryOptions>()
    .setClassMethodName("register")
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
