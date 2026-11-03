import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AgentDirectoryOptions } from "./agent-directory.options"

/** The configurable-module base of the agent directory sub-module. */
const definition = new ConfigurableModuleBuilder<AgentDirectoryOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<AgentDirectoryOptions, "register", "create"> =
    definition.ConfigurableModuleClass
