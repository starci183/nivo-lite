import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ZaloDeliveryJobOptions } from "./zalo-delivery.options"

type Host = ConfigurableModuleHost<ZaloDeliveryJobOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ZaloDeliveryJobOptions>().setClassMethodName("register").build()

/** The configurable-module base of the zalo-delivery module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the zalo-delivery module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the zalo-delivery module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
