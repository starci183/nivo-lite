import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunDecisionsOptions } from "./run-decisions.options"

type Host = ConfigurableModuleHost<RunDecisionsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunDecisionsOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-decisions module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-decisions module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-decisions module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
