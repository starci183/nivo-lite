import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PaymentReceiptsOptions } from "./payment-receipts.options"

type Host = ConfigurableModuleHost<PaymentReceiptsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PaymentReceiptsOptions>().setClassMethodName("register").build()

/** The configurable-module base of the payment-receipts module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the payment-receipts module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the payment-receipts module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
