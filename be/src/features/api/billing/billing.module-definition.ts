import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { BillingApiOptions } from "./billing.options"

type Host = ConfigurableModuleHost<BillingApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<BillingApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the billing module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the billing module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the billing module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
