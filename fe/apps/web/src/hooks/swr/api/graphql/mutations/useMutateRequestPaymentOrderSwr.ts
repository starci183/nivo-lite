"use client"

import { mutateRequestPaymentOrder } from "@/modules/api/graphql/mutations/mutation-request-payment-order"
import type { MutateRequestPaymentOrderRequest } from "@/modules/api/graphql/mutations/mutation-request-payment-order"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestPaymentOrder mutation. */
export const MUTATE_REQUEST_PAYMENT_ORDER_SWR_KEY = "MUTATE_REQUEST_PAYMENT_ORDER_SWR"

/** SWR mutation for {@link mutateRequestPaymentOrder}: Enqueues backend payment-order creation. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestPaymentOrderSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_PAYMENT_ORDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestPaymentOrder({ request: arg }), MUTATE_REQUEST_PAYMENT_ORDER_SWR_KEY)
                .requestPaymentOrder,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateRequestPaymentOrderRequest
}
