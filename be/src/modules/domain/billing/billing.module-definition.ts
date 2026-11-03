import { defineCapabilityModule } from "@starci/nest-kit"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<BillingOptions>({
    optionsInjectionToken: BILLING_OPTIONS,
})
