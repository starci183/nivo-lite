import { Query } from "@nestjs/cqrs"
import type { ReviewTransaction } from "@modules/domain/sepay-transactions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingReviewTransactionsRequest } from "./billing-review-transactions.contracts"

/** Asks for billingReviewTransactions using the verified caller. */
export class BillingReviewTransactionsQuery extends Query<ReadonlyArray<ReviewTransaction>> {
    constructor(readonly params: ExecuteParams<BillingReviewTransactionsRequest>) {
        super()
    }
}
