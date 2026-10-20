import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the work-performers capability. */
export enum WorkPerformersErrorCode {
    /** The item names no record to act on. */
    SubjectMissing = "WORK_PERFORMERS_SUBJECT_MISSING",
    /** The order is gone or was cancelled. */
    OrderUnavailable = "WORK_PERFORMERS_ORDER_UNAVAILABLE",
    /** The customer email could not be sent. */
    EmailNotSent = "WORK_PERFORMERS_EMAIL_NOT_SENT",
    /** The booking could not be moved to the time asked (taken, closed or not movable). */
    BookingNotMoved = "WORK_PERFORMERS_BOOKING_NOT_MOVED",
    /** The reminder has no text to send. */
    ReminderEmpty = "WORK_PERFORMERS_REMINDER_EMPTY",
    /** The approval item does not carry a gateway call to replay. */
    ApprovalInvalid = "WORK_PERFORMERS_APPROVAL_INVALID",
    /** The connector refused or did not answer the approved call. */
    ConnectorRefused = "WORK_PERFORMERS_CONNECTOR_REFUSED",
    /** The front-desk request names no room, or HAKUEN has no stay for it. */
    StayNotFound = "WORK_PERFORMERS_STAY_NOT_FOUND",
    /** The guest of the stay has no conversation with the workspace. */
    GuestUnreachable = "WORK_PERFORMERS_GUEST_UNREACHABLE",
}

/** How each work-performers code travels. */
export const WORK_PERFORMERS_ERROR_KINDS: Record<WorkPerformersErrorCode, ErrorKind> = {
    [WorkPerformersErrorCode.SubjectMissing]: "invalid",
    [WorkPerformersErrorCode.OrderUnavailable]: "not-found",
    [WorkPerformersErrorCode.EmailNotSent]: "unavailable",
    [WorkPerformersErrorCode.BookingNotMoved]: "conflict",
    [WorkPerformersErrorCode.ReminderEmpty]: "invalid",
    [WorkPerformersErrorCode.ApprovalInvalid]: "invalid",
    [WorkPerformersErrorCode.ConnectorRefused]: "unavailable",
    [WorkPerformersErrorCode.StayNotFound]: "not-found",
    [WorkPerformersErrorCode.GuestUnreachable]: "not-found",
}

/** The one error class of the work-performers capability. */
export class WorkPerformersError extends DomainError<WorkPerformersErrorCode> {}
