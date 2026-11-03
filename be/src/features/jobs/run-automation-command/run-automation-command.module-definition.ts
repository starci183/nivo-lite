import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunAutomationCommandOptions } from "./run-automation-command.options"

type Host = ConfigurableModuleHost<RunAutomationCommandOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunAutomationCommandOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-automation-command module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-automation-command module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-automation-command module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
