"use client"

import { queryPaymentOrderRequestStatus } from "@/modules/api/graphql/queries/query-payment-order-request-status"
import type { queryPaymentOrderRequestStatus as PaymentOrderRequestStatusOperation } from "@/modules/api/graphql/queries/query-payment-order-request-status"
import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { isForbiddenFailure, isUnauthenticatedFailure } from "@/modules/failure"

type PaymentOrderRequestStatusResponse = NonNullable<
    Awaited<ReturnType<typeof PaymentOrderRequestStatusOperation>>["data"]
>
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
        workspaceArgumentKey(QUERY_PAYMENT_ORDER_REQUEST_STATUS_SWR_KEY, workspaceId, id),
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
