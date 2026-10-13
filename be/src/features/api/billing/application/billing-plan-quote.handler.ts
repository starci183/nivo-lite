import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { PlanQuote } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingPlanQuoteQuery } from "./billing-plan-quote.query"

@QueryHandler(BillingPlanQuoteQuery)
/** Prices a plan selection through the billing capability; every figure comes from the catalogue. */
export class BillingPlanQuoteHandler extends ICQRSHandler<BillingPlanQuoteQuery, PlanQuote> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(query: BillingPlanQuoteQuery): Promise<PlanQuote> {
        return this.billing.quote(query.params.principal.id, query.params.request)
    }
}
