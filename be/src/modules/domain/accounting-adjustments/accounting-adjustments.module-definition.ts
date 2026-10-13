import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountingAdjustmentsOptions } from "./accounting-adjustments.options"

/** The configurable module base of the adjustments capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountingAdjustmentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
