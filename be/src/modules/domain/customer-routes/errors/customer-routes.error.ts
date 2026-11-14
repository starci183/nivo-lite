import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the customer-routes capability. */
export enum CustomerRoutesErrorCode {
    /** The person the route is for is not a contact of the workspace. */
    ContactUnknown = "CUSTOMER_ROUTES_CONTACT_UNKNOWN",
    /** The id asked to be adopted already names another route. */
    IdTaken = "CUSTOMER_ROUTES_ID_TAKEN",
    /** A claimed delivery row was not there to read back: the ledger lost a row it just wrote. */
    DeliveryMissing = "CUSTOMER_ROUTES_DELIVERY_MISSING",
    /** A heard line the store did not write was not there to read back: the once-key held no row. */
    LineMissing = "CUSTOMER_ROUTES_LINE_MISSING",
}

/** How each customer-routes code travels. */
export const CUSTOMER_ROUTES_ERROR_KINDS: Record<CustomerRoutesErrorCode, ErrorKind> = {
    [CustomerRoutesErrorCode.ContactUnknown]: "not-found",
    [CustomerRoutesErrorCode.IdTaken]: "conflict",
    [CustomerRoutesErrorCode.DeliveryMissing]: "internal",
    [CustomerRoutesErrorCode.LineMissing]: "internal",
}

/** The typed error of the customer-routes capability. */
export class CustomerRoutesError extends DomainError<CustomerRoutesErrorCode> {}
