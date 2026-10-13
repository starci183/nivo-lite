import useSWR from "swr"
import { queryBillingReviewTransactions } from "@/modules/api/graphql/queries/query-billing-review-transactions"

/** Cache identity of billingReviewTransactions. */
export const QUERY_BILLING_REVIEW_TRANSACTIONS_SWR_KEY = "QUERY_BILLING_REVIEW_TRANSACTIONS_SWR"

/** Reads billingReviewTransactions through the backend. */
export const useQueryBillingReviewTransactionsSwr = (
    workspaceId: string | undefined,
    orderIds: ReadonlyArray<string> | undefined,
) =>
    useSWR(
        workspaceId === undefined || orderIds === undefined
            ? null
            : ([QUERY_BILLING_REVIEW_TRANSACTIONS_SWR_KEY, workspaceId, orderIds] as const),
        async ([, , requestedOrderIds]) => {
            const result = await queryBillingReviewTransactions({ request: { orderIds: [...requestedOrderIds] } })
            if (!result.data) throw new Error("billingReviewTransactions answered no data")
            return result.data.billingReviewTransactions
        },
    )
