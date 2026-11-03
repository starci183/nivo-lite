import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { LoyaltyLedgerOptions } from "./loyalty-ledger.options"

/** The configurable-module base of the loyalty-ledger capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<LoyaltyLedgerOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    LoyaltyLedgerOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: LoyaltyLedgerOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
