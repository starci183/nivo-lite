import { defineCapabilityModule } from "@starci/nest-kit"
import type { SepayTransactionsOptions } from "./sepay-transactions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SepayTransactionsOptions>()
