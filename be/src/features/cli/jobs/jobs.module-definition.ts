import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CliJobsOptions } from "./jobs.options"

type Host = ConfigurableModuleHost<CliJobsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CliJobsOptions>().setClassMethodName("register").build()

/** The configurable-module base of the jobs module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the jobs module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the jobs module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
