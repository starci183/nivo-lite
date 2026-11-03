import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { GenerateWithAgentQueueOptions } from "./generate-with-agent-queue.options"

type Host = ConfigurableModuleHost<GenerateWithAgentQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<GenerateWithAgentQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the generate-with-agent-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the generate-with-agent-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the generate-with-agent-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
