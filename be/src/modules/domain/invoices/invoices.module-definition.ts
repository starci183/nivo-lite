import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InvoicesOptions } from "./invoices.options"

/** The configurable-module base of the invoices capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InvoicesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
