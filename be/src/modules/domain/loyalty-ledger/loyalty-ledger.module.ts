import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LoyaltyLedgerService } from "./loyalty-ledger.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-ledger.module-definition"

@Module({})
/** The loyalty ledger capability: the append-only points ledger, balances and the rules that turn purchases into points. */
export class LoyaltyLedgerModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LoyaltyLedgerService],
            exports: [LoyaltyLedgerService],
        }
    }
}
