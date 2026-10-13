import { Module } from "@nestjs/common"
import { RetryFailedStepHandler } from "./application/retry-failed-step.handler"
import { StopFailedStepHandler } from "./application/stop-failed-step.handler"
import { HandoffToAccountingHandler } from "./application/handoff-to-accounting.handler"
import { MarkOrderShippedHandler } from "./application/mark-order-shipped.handler"
import { DecideSalesWorkItemHandler } from "./application/decide-sales-work-item.handler"
import { DecideSalesDraftHandler } from "./application/decide-sales-draft.handler"
import { SalesActionStatusHandler } from "./application/sales-action-status.handler"

@Module({
    providers: [
        RetryFailedStepHandler,
        StopFailedStepHandler,
        HandoffToAccountingHandler,
        MarkOrderShippedHandler,
        DecideSalesWorkItemHandler,
        DecideSalesDraftHandler,
        SalesActionStatusHandler,
    ],
})
/** The application handlers of the Sales GraphQL feature. */
export class SalesApiModule {}
