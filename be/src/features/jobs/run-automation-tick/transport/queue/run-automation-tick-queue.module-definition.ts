import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunAutomationTickQueueOptions } from "./run-automation-tick-queue.options"

type Host = ConfigurableModuleHost<RunAutomationTickQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunAutomationTickQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-automation-tick-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-automation-tick-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-automation-tick-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
