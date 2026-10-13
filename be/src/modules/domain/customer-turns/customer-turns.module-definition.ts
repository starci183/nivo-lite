import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CustomerTurnsOptions } from "./customer-turns.options"

/** The configurable-module base of the customer-turns capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CustomerTurnsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
