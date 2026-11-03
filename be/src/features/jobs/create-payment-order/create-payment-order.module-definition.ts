import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CreatePaymentOrderOptions } from "./create-payment-order.options"

type Host = ConfigurableModuleHost<CreatePaymentOrderOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CreatePaymentOrderOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the create-payment-order module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the create-payment-order module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the create-payment-order module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
