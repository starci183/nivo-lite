import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./accounting.module-definition"
import { AccountingBookService } from "./accounting-book.service"
import { AccountingRoomService } from "./accounting-room.service"
import { AccountingService } from "./accounting.service"
import { DeskDailyService } from "./desk-daily.service"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { FolioReconcileService } from "./folio-reconcile.service"
import { UnwiredAccountingGatewayService } from "./unwired-accounting-gateway.service"

@Module({})
/** Registers the accounting capability once for the application, with the morning desk of the accounting agent. */
export class AccountingModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its services; the gateway adapter is the one the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const gateway = options.gateway ?? UnwiredAccountingGatewayService
        const desk = [AccountingRoomService, DeskDailyService, EinvoiceReviewService, FolioReconcileService]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AccountingBookService,
                AccountingService,
                ...desk,
                gateway,
                { provide: ACCOUNTING_GATEWAY, useExisting: gateway },
            ],
            exports: [AccountingBookService, AccountingService, DeskDailyService],
        }
    }
}
