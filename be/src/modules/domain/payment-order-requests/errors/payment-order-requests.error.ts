import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable errors of the payment-order-requests capability. */
export enum PaymentOrderRequestsErrorCode {
    /** The requested operation or target code is not valid. */
    Invalid = "PAYMENT_ORDER_REQUESTS_INVALID",
    /** Inserting a request did not produce its identity. */
    NotCreated = "PAYMENT_ORDER_REQUESTS_NOT_CREATED",
    /** The fenced job exhausted its retries or encountered an unrecoverable failure. */
    JobFailed = "PAYMENT_ORDER_REQUESTS_JOB_FAILED",
}

/** How each payment-order-requests error travels to the caller. */
export const PAYMENT_ORDER_REQUESTS_ERROR_KINDS: Record<PaymentOrderRequestsErrorCode, ErrorKind> = {
    [PaymentOrderRequestsErrorCode.Invalid]: "invalid",
    [PaymentOrderRequestsErrorCode.NotCreated]: "internal",
    [PaymentOrderRequestsErrorCode.JobFailed]: "internal",
}

/** The error family for payment-order requests. */
export class PaymentOrderRequestsError extends DomainError<PaymentOrderRequestsErrorCode> {}
