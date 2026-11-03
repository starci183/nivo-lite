import { defineCapabilityModule } from "@starci/nest-kit"
import { CUSTOMER_TURNS_OPTIONS } from "./customer-turns.decorators"
import type { CustomerTurnsOptions } from "./customer-turns.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CustomerTurnsOptions>({
    optionsInjectionToken: CUSTOMER_TURNS_OPTIONS,
})
