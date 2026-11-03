import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ZaloDeliveryQueueOptions } from "./zalo-delivery-queue.options"

type Host = ConfigurableModuleHost<ZaloDeliveryQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ZaloDeliveryQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the zalo-delivery-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the zalo-delivery-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the zalo-delivery-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
