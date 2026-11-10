import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the lead-freezes capability. */
export enum LeadFreezesErrorCode {
    /** A stored freeze is not the shape its entity declares. */
    RecordUnreadable = "LEAD_FREEZES_RECORD_UNREADABLE",
    /** Other writers kept moving the freeze; the write was given up and may be asked again. */
    Contended = "LEAD_FREEZES_CONTENDED",
    /** Nothing is frozen for this customer, or the freeze is not one of this workspace. */
    NotFound = "LEAD_FREEZES_NOT_FOUND",
}

/** How each lead-freezes code travels. */
export const LEAD_FREEZES_ERROR_KINDS: Record<LeadFreezesErrorCode, ErrorKind> = {
    [LeadFreezesErrorCode.RecordUnreadable]: "internal",
    [LeadFreezesErrorCode.Contended]: "conflict",
    [LeadFreezesErrorCode.NotFound]: "not-found",
}

/** The typed error of the lead-freezes capability. */
export class LeadFreezesError extends DomainError<LeadFreezesErrorCode> {}
