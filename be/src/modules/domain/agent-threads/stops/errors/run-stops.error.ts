import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the stops of thread runs. */
export enum RunStopsErrorCode {
    /** A stored stop is not the shape its entity declares. */
    RecordUnreadable = "RUN_STOPS_RECORD_UNREADABLE",
    /** Other writers kept moving the stop; the write was given up and may be asked again. */
    Contended = "RUN_STOPS_CONTENDED",
    /** No stop of this run and step, or it is not of this workspace. */
    NotFound = "RUN_STOPS_NOT_FOUND",
    /** A decision that is none of the five kinds a stop takes. */
    DecisionInvalid = "RUN_STOPS_DECISION_INVALID",
    /** The stop was already resolved; a late decision changes nothing. */
    AlreadyResolved = "RUN_STOPS_ALREADY_RESOLVED",
}

/** How each code travels. */
export const RUN_STOPS_ERROR_KINDS: Record<RunStopsErrorCode, ErrorKind> = {
    [RunStopsErrorCode.RecordUnreadable]: "internal",
    [RunStopsErrorCode.Contended]: "conflict",
    [RunStopsErrorCode.NotFound]: "not-found",
    [RunStopsErrorCode.DecisionInvalid]: "invalid",
    [RunStopsErrorCode.AlreadyResolved]: "conflict",
}

/** The typed error of the stops of thread runs. */
export class RunStopsError extends DomainError<RunStopsErrorCode> {}
