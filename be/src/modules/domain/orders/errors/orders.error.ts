import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the orders capability. */
export enum OrdersErrorCode {
    /** A shipment has empty or overlong carrier details. */
    ShipmentInvalid = "ORDERS_SHIPMENT_INVALID",
    /** The order cannot be shipped, or somebody shipped it already. */
    NotShippable = "ORDERS_NOT_SHIPPABLE",
    /** Accounting requires a confirmed order. */
    NotConfirmed = "ORDERS_NOT_CONFIRMED",
    /** The order already has an active invoice. */
    AlreadyInvoiced = "ORDERS_ALREADY_INVOICED",
    /** No free order number was found after several attempts. */
    NotNumbered = "ORDERS_NOT_NUMBERED",
}

/** How each orders code travels. */
export const ORDERS_ERROR_KINDS: Record<OrdersErrorCode, ErrorKind> = {
    [OrdersErrorCode.ShipmentInvalid]: "invalid",
    [OrdersErrorCode.NotShippable]: "conflict",
    [OrdersErrorCode.NotConfirmed]: "conflict",
    [OrdersErrorCode.AlreadyInvoiced]: "conflict",
    [OrdersErrorCode.NotNumbered]: "internal",
}

/** The one error class of the orders capability. */
export class OrdersError extends DomainError<OrdersErrorCode> {}
