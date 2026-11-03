import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunAgentStepQueueOptions } from "./run-agent-step-queue.options"

type Host = ConfigurableModuleHost<RunAgentStepQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunAgentStepQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-agent-step-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-agent-step-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-agent-step-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
