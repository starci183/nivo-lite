import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { InvoicesOptions } from "./invoices.options"

/** The configurable-module base of the invoices capability. */
const definition = new ConfigurableModuleBuilder<InvoicesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    InvoicesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: InvoicesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
