import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./invoices.module-definition"
import { InvoicesService } from "./invoices.service"
import { InvoicesCashReadService } from "./invoices-cash-read.service"
import { InvoicesFiguresService } from "./invoices-figures.service"
import { InvoicesLedgerService } from "./invoices-ledger.service"

@Module({})
/** The invoices of a workspace over the primary Supabase PostgreSQL connection: the only writer of public.invoices. */
export class InvoicesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                InvoicesService,
                InvoicesLedgerService,
                InvoicesFiguresService,
                InvoicesCashReadService,
            ],
            exports: [InvoicesService, InvoicesLedgerService, InvoicesFiguresService, InvoicesCashReadService],
        }
    }
}
