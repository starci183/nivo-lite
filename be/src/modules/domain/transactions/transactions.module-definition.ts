import { defineCapabilityModule } from "@starci/nest-kit"
import type { TransactionsOptions } from "./transactions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TransactionsOptions>()
