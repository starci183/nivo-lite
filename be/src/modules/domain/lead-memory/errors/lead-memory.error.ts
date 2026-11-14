import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the lead-memory capability. */
export enum LeadMemoryErrorCode {
    /** Other writers kept moving the facts of the customer; the write was given up and may be asked again. */
    Contended = "LEAD_MEMORY_CONTENDED",
}

/** How each lead-memory code travels. */
export const LEAD_MEMORY_ERROR_KINDS: Record<LeadMemoryErrorCode, ErrorKind> = {
    [LeadMemoryErrorCode.Contended]: "conflict",
}

/** The typed error of the lead-memory capability. */
export class LeadMemoryError extends DomainError<LeadMemoryErrorCode> {}
