import { Query } from "@nestjs/cqrs"
import type { PlanQuote } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingPlanQuoteRequest } from "./billing-plan-quote.contracts"

/** Asks what a plan selection costs a workspace, using the verified caller. */
export class BillingPlanQuoteQuery extends Query<PlanQuote> {
    constructor(readonly params: ExecuteParams<BillingPlanQuoteRequest>) {
        super()
    }
}
