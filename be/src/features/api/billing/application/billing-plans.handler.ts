import { QueryHandler } from "@nestjs/cqrs"
import { BillingService, type Plan } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { BillingPlansQuery } from "./billing-plans.query"

@QueryHandler(BillingPlansQuery)
/** Answers billingPlans through its domain capability. */
export class BillingPlansHandler extends ICQRSHandler<BillingPlansQuery, ReadonlyArray<Plan>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override async process(_query: BillingPlansQuery): Promise<ReadonlyArray<Plan>> {
        return this.billing.listPlans()
    }
}
