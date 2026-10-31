import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SupplierPayablesOptions } from "./supplier-payables.options"

/** The configurable module base of the supplier-payables capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SupplierPayablesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
