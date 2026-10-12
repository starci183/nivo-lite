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
}

/** How each booking code travels. */
export const BOOKINGS_ERROR_KINDS: Record<BookingsErrorCode, ErrorKind> = {
    [BookingsErrorCode.PageNotFound]: "not-found",
    [BookingsErrorCode.NotFound]: "not-found",
    [BookingsErrorCode.NotChangeable]: "conflict",
    [BookingsErrorCode.NotCreated]: "internal",
}

/** The one error class of the booking capability. */
export class BookingsError extends DomainError<BookingsErrorCode> {}
