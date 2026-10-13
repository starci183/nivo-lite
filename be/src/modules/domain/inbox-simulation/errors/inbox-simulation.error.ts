import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Failures of the Inbox simulator. */
export enum InboxSimulationErrorCode {
    /** The bounded input is invalid after trimming. */
    Invalid = "INBOX_SIMULATION_INVALID",
    /** The requested event does not belong to the selected workspace. */
    NotFound = "INBOX_SIMULATION_NOT_FOUND",
    /** The input still has queued work held by an earlier attempt or awaiting the next batch. */
    Pending = "INBOX_SIMULATION_PENDING",
    /** The input has a permanent failed work result. */
    Failed = "INBOX_SIMULATION_FAILED",
}

/** How simulator failures travel to the browser. */
export const INBOX_SIMULATION_ERROR_KINDS: Record<InboxSimulationErrorCode, ErrorKind> = {
    [InboxSimulationErrorCode.Invalid]: "invalid",
    [InboxSimulationErrorCode.NotFound]: "not-found",
    [InboxSimulationErrorCode.Pending]: "unavailable",
    [InboxSimulationErrorCode.Failed]: "internal",
}

/** The simulator's domain failure. */
export class InboxSimulationError extends DomainError<InboxSimulationErrorCode> {}
