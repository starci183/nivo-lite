import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunLeadActionOptions } from "./run-lead-action.options"

type Host = ConfigurableModuleHost<RunLeadActionOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunLeadActionOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-lead-action module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-lead-action module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-lead-action module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
