import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the booking capability. */
export enum BookingsErrorCode {
    /** No published booking page has the slug. */
    PageNotFound = "BOOKINGS_PAGE_NOT_FOUND",
    /** The workspace has no booking with the id. */
    NotFound = "BOOKINGS_NOT_FOUND",
    /** The booking is closed and cannot take the change. */
    NotChangeable = "BOOKINGS_NOT_CHANGEABLE",
    /** The insert answered no row: the booking was not written. */
    NotCreated = "BOOKINGS_NOT_CREATED",
    /** A setup field or date range is invalid. */
    InvalidInput = "BOOKINGS_INVALID_INPUT",
    /** A catalog row does not belong to the workspace. */
    CatalogNotFound = "BOOKINGS_CATALOG_NOT_FOUND",
    /** Another workspace owns the public page slug. */
    SlugTaken = "BOOKINGS_SLUG_TAKEN",
    /** A service must be selected. */
    ServiceRequired = "BOOKINGS_SERVICE_REQUIRED",
    /** A customer name is required. */
    NameRequired = "BOOKINGS_NAME_REQUIRED",
    /** The local date or time is invalid. */
    DateTimeInvalid = "BOOKINGS_DATETIME_INVALID",
    /** The selected service is unavailable. */
    ServiceNotFound = "BOOKINGS_SERVICE_NOT_FOUND",
    /** The business is closed at the requested time. */
    Closed = "BOOKINGS_CLOSED",
    /** Every suitable resource is full. */
    Full = "BOOKINGS_FULL",
    /** No suitable resource exists. */
    NoResource = "BOOKINGS_NO_RESOURCE",
    /** Another booking holds the requested slot. */
    Taken = "BOOKINGS_TAKEN",
    /** A closed booking cannot be moved. */
    NotMovable = "BOOKINGS_NOT_MOVABLE",
    /** The selected resource is unavailable. */
    ResourceNotFound = "BOOKINGS_RESOURCE_NOT_FOUND",
    /** The customer phone is invalid. */
    PhoneInvalid = "BOOKINGS_PHONE_INVALID",
}

/** How each booking code travels. */
export const BOOKINGS_ERROR_KINDS: Record<BookingsErrorCode, ErrorKind> = {
    [BookingsErrorCode.PageNotFound]: "not-found",
    [BookingsErrorCode.NotFound]: "not-found",
    [BookingsErrorCode.NotChangeable]: "conflict",
    [BookingsErrorCode.NotCreated]: "internal",
    [BookingsErrorCode.InvalidInput]: "invalid",
    [BookingsErrorCode.CatalogNotFound]: "not-found",
    [BookingsErrorCode.SlugTaken]: "conflict",
    [BookingsErrorCode.ServiceRequired]: "invalid",
    [BookingsErrorCode.NameRequired]: "invalid",
    [BookingsErrorCode.DateTimeInvalid]: "invalid",
    [BookingsErrorCode.ServiceNotFound]: "not-found",
    [BookingsErrorCode.Closed]: "conflict",
    [BookingsErrorCode.Full]: "conflict",
    [BookingsErrorCode.NoResource]: "conflict",
    [BookingsErrorCode.Taken]: "conflict",
    [BookingsErrorCode.NotMovable]: "conflict",
    [BookingsErrorCode.ResourceNotFound]: "not-found",
    [BookingsErrorCode.PhoneInvalid]: "invalid",
}

/** The one error class of the booking capability. */
export class BookingsError extends DomainError<BookingsErrorCode> {}
