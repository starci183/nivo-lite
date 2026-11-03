import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunAutomationCommandQueueOptions } from "./run-automation-command-queue.options"

type Host = ConfigurableModuleHost<RunAutomationCommandQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunAutomationCommandQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-automation-command-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-automation-command-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-automation-command-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
