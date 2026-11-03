import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunLeadGenQueueOptions } from "./run-lead-gen-queue.options"

type Host = ConfigurableModuleHost<RunLeadGenQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunLeadGenQueueOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-lead-gen-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-lead-gen-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-lead-gen-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
