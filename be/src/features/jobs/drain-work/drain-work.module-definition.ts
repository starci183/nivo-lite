import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DrainWorkOptions } from "./drain-work.options"

type Host = ConfigurableModuleHost<DrainWorkOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DrainWorkOptions>().setClassMethodName("register").build()

/** The configurable-module base of the drain-work module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the drain-work module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the drain-work module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
