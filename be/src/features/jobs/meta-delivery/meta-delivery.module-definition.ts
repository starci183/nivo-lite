import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { MetaDeliveryJobOptions } from "./meta-delivery.options"

type Host = ConfigurableModuleHost<MetaDeliveryJobOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<MetaDeliveryJobOptions>().setClassMethodName("register").build()

/** The configurable-module base of the meta-delivery module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the meta-delivery module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the meta-delivery module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
