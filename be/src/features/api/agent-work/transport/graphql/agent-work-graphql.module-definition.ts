import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AgentWorkGraphqlOptions } from "./agent-work-graphql.options"

type Host = ConfigurableModuleHost<AgentWorkGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AgentWorkGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the agent-work-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the agent-work-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the agent-work-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
