import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyLedgerOptions } from "./loyalty-ledger.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyLedgerOptions>()
