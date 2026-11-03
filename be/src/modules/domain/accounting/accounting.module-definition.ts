import { defineCapabilityModule } from "@starci/nest-kit"
import type { AccountingOptions } from "./accounting.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AccountingOptions>()
