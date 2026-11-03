import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { MetaDeliveryQueueOptions } from "./meta-delivery-queue.options"

type Host = ConfigurableModuleHost<MetaDeliveryQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<MetaDeliveryQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the meta-delivery-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the meta-delivery-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the meta-delivery-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
