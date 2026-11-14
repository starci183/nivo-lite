import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the brain capability. */
export enum BrainErrorCode {
    /** The model did not give a usable answer; the job is retried. */
    ModelUnavailable = "BRAIN_MODEL_UNAVAILABLE",
    /** The caller asked for a command they never made. */
    CommandNotFound = "BRAIN_COMMAND_NOT_FOUND",
    /** Facts are applied together only from a document kept internal: a bulk path never makes anything public. */
    BulkNeedsInternal = "BRAIN_BULK_NEEDS_INTERNAL",
    /** A validity window that ends before (or when) it starts. */
    WindowInvalid = "BRAIN_WINDOW_INVALID",
    /**
     * The guard of an automatic write, run under the workspace's in-force lock, found a value for the key in force since its verdict was
     * read: the same one (`joined`) or one that argues with it (`raced`). Nothing was written; the settle that threw it catches it.
     */
    SettleLostRace = "BRAIN_SETTLE_LOST_RACE",
}

/** How each brain code travels. */
export const BRAIN_ERROR_KINDS: Record<BrainErrorCode, ErrorKind> = {
    [BrainErrorCode.ModelUnavailable]: "unavailable",
    [BrainErrorCode.CommandNotFound]: "not-found",
    [BrainErrorCode.BulkNeedsInternal]: "conflict",
    [BrainErrorCode.WindowInvalid]: "invalid",
    [BrainErrorCode.SettleLostRace]: "conflict",
}

/** The one error class of the brain capability. */
export class BrainError extends DomainError<BrainErrorCode> {}
