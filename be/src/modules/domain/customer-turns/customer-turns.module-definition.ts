import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CUSTOMER_TURNS_OPTIONS } from "./customer-turns.decorators"
import type { CustomerTurnsOptions } from "./customer-turns.options"

/** The configurable-module base of the customer-turns capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CustomerTurnsOptions>({
    optionsInjectionToken: CUSTOMER_TURNS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
