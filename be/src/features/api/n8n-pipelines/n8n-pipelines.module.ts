import { Module } from "@nestjs/common"
import { FetchDaySummaryHandler } from "./application/fetch-day-summary.handler"
import { FetchOverdueInvoicesHandler } from "./application/fetch-overdue-invoices.handler"
import { FetchMonthLedgerHandler } from "./application/fetch-month-ledger.handler"
import { SendEmailHandler } from "./application/send-email.handler"
import { CompleteRunHandler } from "./application/complete-run.handler"

@Module({
    providers: [
        FetchDaySummaryHandler,
        FetchOverdueInvoicesHandler,
        FetchMonthLedgerHandler,
        SendEmailHandler,
        CompleteRunHandler,
    ],
})
/** The n8n-pipelines feature: the handlers of its application. */
export class N8nPipelinesApiModule {}
