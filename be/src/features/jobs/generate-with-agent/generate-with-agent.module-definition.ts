import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { GenerateWithAgentOptions } from "./generate-with-agent.options"

type Host = ConfigurableModuleHost<GenerateWithAgentOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<GenerateWithAgentOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the generate-with-agent module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the generate-with-agent module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the generate-with-agent module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
