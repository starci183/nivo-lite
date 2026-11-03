import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunSetupTurnOptions } from "./run-setup-turn.options"

type Host = ConfigurableModuleHost<RunSetupTurnOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunSetupTurnOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-setup-turn module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-setup-turn module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-setup-turn module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
