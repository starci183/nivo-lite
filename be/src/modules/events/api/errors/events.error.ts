import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the events capability. */
export enum EventsErrorCode {
    /** A payload field held a value outside the set its event lists for it. */
    ValueOutsideSet = "EVENTS_VALUE_OUTSIDE_SET",
}

/** How each events code travels. */
export const EVENTS_ERROR_KINDS: Record<EventsErrorCode, ErrorKind> = {
    [EventsErrorCode.ValueOutsideSet]: "invalid",
}

/** The one error class of the events capability. */
export class EventsError extends DomainError<EventsErrorCode> {}
