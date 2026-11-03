import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { SupplierPayablesOptions } from "./supplier-payables.options"

/** The configurable module base of the supplier-payables capability. */
const definition = new ConfigurableModuleBuilder<SupplierPayablesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    SupplierPayablesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: SupplierPayablesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
