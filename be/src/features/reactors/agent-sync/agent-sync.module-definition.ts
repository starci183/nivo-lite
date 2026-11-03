import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentSyncOptions } from "./agent-sync.options"

type Host = ConfigurableModuleHost<AgentSyncOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentSyncOptions>().setClassMethodName("register").build()

/** The configurable-module base of the agent-sync module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-sync module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-sync module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
