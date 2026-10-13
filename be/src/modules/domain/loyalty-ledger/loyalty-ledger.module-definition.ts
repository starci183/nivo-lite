import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyLedgerOptions } from "./loyalty-ledger.options"

/** The configurable-module base of the loyalty-ledger capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyLedgerOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
