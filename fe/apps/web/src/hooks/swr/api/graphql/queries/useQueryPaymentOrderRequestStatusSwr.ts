import useSWR, { type SWRConfiguration } from "swr"
import { isForbiddenFailure, isUnauthenticatedFailure } from "@/modules/api"
import { queryPaymentOrderRequestStatus } from "@/modules/api/graphql/queries/query-payment-order-request-status"

type PaymentOrderRequestStatusResponse = NonNullable<Awaited<ReturnType<typeof queryPaymentOrderRequestStatus>>["data"]>
type PaymentOrderRequestStatus = NonNullable<PaymentOrderRequestStatusResponse["paymentOrderRequestStatus"]>
type PaymentOrderRequestStatusOptions = SWRConfiguration<PaymentOrderRequestStatus, Error>

class PaymentOrderRequestMissingError extends Error {
    override readonly name = "PaymentOrderRequestMissingError"
}

const retryPaymentOrderRequestStatus = (error: Error): boolean =>
    !(error instanceof PaymentOrderRequestMissingError || isForbiddenFailure(error) || isUnauthenticatedFailure(error))

/** Cache identity of paymentOrderRequestStatus. */
export const QUERY_PAYMENT_ORDER_REQUEST_STATUS_SWR_KEY = "QUERY_PAYMENT_ORDER_REQUEST_STATUS_SWR"

/** Polls the request until its terminal outcome. */
export const useQueryPaymentOrderRequestStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    options?: PaymentOrderRequestStatusOptions,
) =>
    useSWR(
        workspaceId === undefined || id === undefined
            ? null
            : ([QUERY_PAYMENT_ORDER_REQUEST_STATUS_SWR_KEY, workspaceId, id] as const),
        async ([, , requestedId]) => {
            const result = await queryPaymentOrderRequestStatus({ request: { id: requestedId } })
            if (!result.data) throw new Error("paymentOrderRequestStatus answered no data")
            const status = result.data.paymentOrderRequestStatus
            if (!status) throw new PaymentOrderRequestMissingError("The payment order request was not found")
            return status
        },
        {
            ...options,
            shouldRetryOnError: retryPaymentOrderRequestStatus,
            refreshInterval: (data) => (data?.status === "succeeded" || data?.status === "failed" ? 0 : 2000),
        },
    )
