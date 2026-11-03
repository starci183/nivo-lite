import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RendersApiOptions } from "./renders.options"

type Host = ConfigurableModuleHost<RendersApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RendersApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the renders module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the renders module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the renders module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
