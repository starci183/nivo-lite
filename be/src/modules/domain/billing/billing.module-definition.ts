import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"

/** The configurable-module base of the billing capability. */
const definition = new ConfigurableModuleBuilder<BillingOptions>({ optionsInjectionToken: BILLING_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BillingOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: BillingOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
