import { Query } from "@nestjs/cqrs"
import type { Plan } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingPlanRequest } from "./billing-plan.contracts"

/** Asks for billingPlan using the verified caller. */
export class BillingPlanQuery extends Query<Plan | null> {
    constructor(readonly params: ExecuteParams<BillingPlanRequest>) {
        super()
    }
}
