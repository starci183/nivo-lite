import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the payment-orders capability. */
export enum PaymentOrdersErrorCode {
    /** No free order code could be allocated after the retries. */
    CodeExhausted = "PAYMENT_ORDERS_CODE_EXHAUSTED",
}

/** How each payment-orders code travels. */
export const PAYMENT_ORDERS_ERROR_KINDS: Record<PaymentOrdersErrorCode, ErrorKind> = {
    [PaymentOrdersErrorCode.CodeExhausted]: "internal",
}

/** The one error class of the payment-orders capability. */
export class PaymentOrdersError extends DomainError<PaymentOrdersErrorCode> {}
