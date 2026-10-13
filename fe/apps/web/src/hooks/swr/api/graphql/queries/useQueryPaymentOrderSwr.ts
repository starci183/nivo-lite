import useSWR from "swr"
import { queryPaymentOrder } from "@/modules/api/graphql/queries/query-payment-order"

/** Cache identity of paymentOrder. */
export const QUERY_PAYMENT_ORDER_SWR_KEY = "QUERY_PAYMENT_ORDER_SWR"

/** Reads and revalidates a pending payment order. */
export const useQueryPaymentOrderSwr = (workspaceId: string | undefined, id: string | undefined) =>
    useSWR(
        workspaceId === undefined || id === undefined
            ? null
            : ([QUERY_PAYMENT_ORDER_SWR_KEY, workspaceId, id] as const),
        async ([, , requestedId]) => {
            const result = await queryPaymentOrder({ request: { id: requestedId } })
            if (!result.data) throw new Error("paymentOrder answered no data")
            return result.data.paymentOrder
        },
        { refreshInterval: (data) => (data?.status === "pending" ? 3000 : 0) },
    )
