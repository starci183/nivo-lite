import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the brain capability. */
export enum BrainErrorCode {
    /** The model did not give a usable answer; the job is retried. */
    ModelUnavailable = "BRAIN_MODEL_UNAVAILABLE",
    /** The caller asked for a command they never made. */
    CommandNotFound = "BRAIN_COMMAND_NOT_FOUND",
    /** Facts are applied together only from a document kept internal: a bulk path never makes anything public. */
    BulkNeedsInternal = "BRAIN_BULK_NEEDS_INTERNAL",
}

/** How each brain code travels. */
export const BRAIN_ERROR_KINDS: Record<BrainErrorCode, ErrorKind> = {
    [BrainErrorCode.ModelUnavailable]: "unavailable",
    [BrainErrorCode.CommandNotFound]: "not-found",
    [BrainErrorCode.BulkNeedsInternal]: "conflict",
}

/** The one error class of the brain capability. */
export class BrainError extends DomainError<BrainErrorCode> {}
