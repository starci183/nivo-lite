import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the orders capability. */
export enum OrdersErrorCode {
    /** No free order number was found after several attempts. */
    NotNumbered = "ORDERS_NOT_NUMBERED",
}

/** How each orders code travels. */
export const ORDERS_ERROR_KINDS: Record<OrdersErrorCode, ErrorKind> = {
    [OrdersErrorCode.NotNumbered]: "internal",
}

/** The one error class of the orders capability. */
export class OrdersError extends DomainError<OrdersErrorCode> {}
