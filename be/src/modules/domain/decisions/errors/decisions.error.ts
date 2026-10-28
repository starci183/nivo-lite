import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the decisions capability. */
export enum DecisionsErrorCode {
    /** Another worker's claim still holds the queued item. */
    WorkBusy = "DECISIONS_WORK_BUSY",
    /** Only failed work may be retried or stopped. */
    NotFailed = "DECISIONS_NOT_FAILED",
    /** A concurrent caller changed the item. */
    StateChanged = "DECISIONS_STATE_CHANGED",
    /** The record asked for does not exist in the workspace. */
    NotFound = "DECISIONS_NOT_FOUND",
    /** The caller may not decide or change this. */
    NotAllowed = "DECISIONS_NOT_ALLOWED",
    /** The command bus refused a command; the refusal and its detail ride in the params. */
    CommandRefused = "DECISIONS_COMMAND_REFUSED",
    /** The authority action is not in the registry. */
    UnknownAction = "DECISIONS_UNKNOWN_ACTION",
    /** The action can never run by itself, so its rule may not be "auto". */
    ModeCapped = "DECISIONS_MODE_CAPPED",
    /** The work item is not waiting for a decision any more. */
    NotWaiting = "DECISIONS_NOT_WAITING",
    /** The work could not be done; the reason rides in the params. */
    WorkFailed = "DECISIONS_WORK_FAILED",
    /** The person approved but required data is still missing; the fields ride in the params. */
    StillMissing = "DECISIONS_STILL_MISSING",
    /** The person approved but has not chosen among the candidates yet. */
    ChooseCandidate = "DECISIONS_CHOOSE_CANDIDATE",
    /** Approving this action needs the written basis of the person, and it is too short or absent. */
    BasisRequired = "DECISIONS_BASIS_REQUIRED",
    /** Holding a waiting item needs a written note. */
    HoldNoteRequired = "DECISIONS_HOLD_NOTE_REQUIRED",
    /** The staff member is not in this workspace. */
    StaffNotFound = "DECISIONS_STAFF_NOT_FOUND",
    /** A message to a customer reached the engine with no performer registered: the registrar did not run, so nothing may be recorded as done. */
    NoPerformer = "DECISIONS_NO_PERFORMER",
}

/** How each decisions code travels. */
export const DECISIONS_ERROR_KINDS: Record<DecisionsErrorCode, ErrorKind> = {
    [DecisionsErrorCode.WorkBusy]: "unavailable",
    [DecisionsErrorCode.NotFailed]: "conflict",
    [DecisionsErrorCode.StateChanged]: "conflict",
    [DecisionsErrorCode.NotFound]: "not-found",
    [DecisionsErrorCode.NotAllowed]: "forbidden",
    [DecisionsErrorCode.CommandRefused]: "invalid",
    [DecisionsErrorCode.UnknownAction]: "invalid",
    [DecisionsErrorCode.ModeCapped]: "invalid",
    [DecisionsErrorCode.NotWaiting]: "conflict",
    [DecisionsErrorCode.WorkFailed]: "internal",
    [DecisionsErrorCode.StillMissing]: "invalid",
    [DecisionsErrorCode.ChooseCandidate]: "invalid",
    [DecisionsErrorCode.BasisRequired]: "invalid",
    [DecisionsErrorCode.HoldNoteRequired]: "invalid",
    [DecisionsErrorCode.StaffNotFound]: "not-found",
    [DecisionsErrorCode.NoPerformer]: "internal",
}

/** The one error class of the decisions capability. */
export class DecisionsError extends DomainError<DecisionsErrorCode> {}
