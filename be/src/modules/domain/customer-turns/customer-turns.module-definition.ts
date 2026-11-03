import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CUSTOMER_TURNS_OPTIONS } from "./customer-turns.decorators"
import type { CustomerTurnsOptions } from "./customer-turns.options"

/** The configurable-module base of the customer-turns capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<CustomerTurnsOptions>({
    optionsInjectionToken: CUSTOMER_TURNS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    CustomerTurnsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: CustomerTurnsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
