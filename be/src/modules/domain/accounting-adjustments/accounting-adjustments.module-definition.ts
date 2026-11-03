import { defineCapabilityModule } from "@starci/nest-kit"
import type { AccountingAdjustmentsOptions } from "./accounting-adjustments.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AccountingAdjustmentsOptions>()
