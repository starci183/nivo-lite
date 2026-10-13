import type { ReviewTransaction } from "@modules/domain/sepay-transactions"
import type { BillingReviewTransactionsRequest } from "../../application/billing-review-transactions.contracts"
import type { BillingReviewTransactionType } from "./dto/billing-review-transaction.type"
import type { BillingReviewTransactionsInput } from "./dto/billing-review-transactions.input"

/** Maps the GraphQL selector to the query request. */
export const toBillingReviewTransactionsRequest = (
    workspaceId: string,
    input: BillingReviewTransactionsInput,
): BillingReviewTransactionsRequest => ({ workspaceId, orderIds: input.orderIds })

/** Maps the domain answer to the GraphQL contract. */
export const toBillingReviewTransactionsType = (
    result: ReadonlyArray<ReviewTransaction>,
): ReadonlyArray<BillingReviewTransactionType> => result
