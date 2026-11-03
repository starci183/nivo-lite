import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunLeadActionQueueOptions } from "./run-lead-action-queue.options"

type Host = ConfigurableModuleHost<RunLeadActionQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunLeadActionQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-lead-action-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-lead-action-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-lead-action-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
