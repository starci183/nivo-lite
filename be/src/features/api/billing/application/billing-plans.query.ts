import { Query } from "@nestjs/cqrs"
import type { Plan } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingPlansRequest } from "./billing-plans.contracts"

/** Asks for billingPlans using the verified caller. */
export class BillingPlansQuery extends Query<ReadonlyArray<Plan>> {
    constructor(readonly params: ExecuteParams<BillingPlansRequest>) {
        super()
    }
}
