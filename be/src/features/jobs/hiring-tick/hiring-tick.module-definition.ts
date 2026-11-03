import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { HiringTickOptions } from "./hiring-tick.options"

type Host = ConfigurableModuleHost<HiringTickOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<HiringTickOptions>().setClassMethodName("register").build()

/** The configurable-module base of the hiring-tick module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the hiring-tick module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the hiring-tick module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
