import useSWR from "swr"
import { queryPaymentOrders } from "@/modules/api/graphql/queries/query-payment-orders"

/** Cache identity of paymentOrders. */
export const QUERY_PAYMENT_ORDERS_SWR_KEY = "QUERY_PAYMENT_ORDERS_SWR"

/** Reads the payment orders of the selected workspace. */
export const useQueryPaymentOrdersSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_PAYMENT_ORDERS_SWR_KEY, workspaceId], async () => {
        const result = await queryPaymentOrders()
        if (!result.data) throw new Error("paymentOrders answered no data")
        return result.data.paymentOrders
    })
