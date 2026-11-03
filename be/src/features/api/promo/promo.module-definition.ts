import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PromoApiOptions } from "./promo.options"

type Host = ConfigurableModuleHost<PromoApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PromoApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the promo module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the promo module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the promo module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
