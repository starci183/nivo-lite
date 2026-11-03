import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SweepAgentWorkOptions } from "./sweep-agent-work.options"

type Host = ConfigurableModuleHost<SweepAgentWorkOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SweepAgentWorkOptions>().setClassMethodName("register").build()

/** The configurable-module base of the sweep-agent-work module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the sweep-agent-work module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the sweep-agent-work module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
