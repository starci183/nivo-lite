import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Persistence failures of the inbound-events capability. */
export enum InboundEventsErrorCode {
    /** A repeated input or credit whose first record cannot be read back. */
    Unreadable = "INBOUND_EVENTS_UNREADABLE",
}

/** How each inbound-events code travels. */
export const INBOUND_EVENTS_ERROR_KINDS: Record<InboundEventsErrorCode, ErrorKind> = {
    [InboundEventsErrorCode.Unreadable]: "internal",
}

/** The one error class of the inbound-events capability. */
export class InboundEventsError extends DomainError<InboundEventsErrorCode> {}
