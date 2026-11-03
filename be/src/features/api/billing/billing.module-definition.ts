import { defineConfigurableModule } from "@starci/nest-kit"
import type { BillingApiOptions } from "./billing.options"

/** The configurable-module base of the billing module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BillingApiOptions>()
