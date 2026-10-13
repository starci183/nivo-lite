import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./transactions.module-definition"
import { TransactionsService } from "./transactions.service"

@Module({})
/** The payments of a workspace as the ledger sees them over the primary Supabase PostgreSQL connection: the only writer of public.transactions. */
export class TransactionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), TransactionsService], exports: [TransactionsService] }
    }
}
