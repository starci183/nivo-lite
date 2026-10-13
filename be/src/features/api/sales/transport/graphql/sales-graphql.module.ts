import { Module } from "@nestjs/common"
import { SalesApiModule } from "../../sales.module"
import { RetryFailedStepResolver } from "./retry-failed-step.resolver"
import { StopFailedStepResolver } from "./stop-failed-step.resolver"
import { HandoffToAccountingResolver } from "./handoff-to-accounting.resolver"
import { MarkOrderShippedResolver } from "./mark-order-shipped.resolver"
import { DecideSalesWorkItemResolver } from "./decide-sales-work-item.resolver"
import { DecideSalesDraftResolver } from "./decide-sales-draft.resolver"
import { SalesActionStatusResolver } from "./sales-action-status.resolver"

@Module({
    imports: [SalesApiModule],
    providers: [
        RetryFailedStepResolver,
        StopFailedStepResolver,
        HandoffToAccountingResolver,
        MarkOrderShippedResolver,
        DecideSalesWorkItemResolver,
        DecideSalesDraftResolver,
        SalesActionStatusResolver,
    ],
})
/** The GraphQL transport of the Sales feature. */
export class SalesGraphqlModule {}
