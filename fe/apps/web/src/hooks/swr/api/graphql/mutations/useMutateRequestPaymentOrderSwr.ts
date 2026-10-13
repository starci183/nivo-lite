import { mutateRequestPaymentOrder } from "@/modules/api/graphql/mutations/mutation-request-payment-order"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestPaymentOrder mutation. */
export const MUTATE_REQUEST_PAYMENT_ORDER_SWR_KEY = "MUTATE_REQUEST_PAYMENT_ORDER_SWR"

/** SWR mutation for {@link mutateRequestPaymentOrder}: Enqueues backend payment-order creation. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestPaymentOrderSwr = () => useGraphQLMutationSwr(MUTATE_REQUEST_PAYMENT_ORDER_SWR_KEY, mutateRequestPaymentOrder, (data) => data.requestPaymentOrder)
