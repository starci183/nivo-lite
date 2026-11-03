import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunZaloWizardOptions } from "./run-zalo-wizard.options"

type Host = ConfigurableModuleHost<RunZaloWizardOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunZaloWizardOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-zalo-wizard module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-zalo-wizard module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-zalo-wizard module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
