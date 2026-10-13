import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { Plan } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingPlanQuery } from "./billing-plan.query"

@QueryHandler(BillingPlanQuery)
/** Answers billingPlan through its domain capability. */
export class BillingPlanHandler extends ICQRSHandler<BillingPlanQuery, Plan | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override async process(query: BillingPlanQuery): Promise<Plan | null> {
        return this.billing.findPlan(query.params.request.code)
    }
}
