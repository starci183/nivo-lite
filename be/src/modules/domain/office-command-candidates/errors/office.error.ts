import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the office capability. */
export enum OfficeErrorCode {
    /** The message does not exist in the workspace. */
    MessageNotFound = "OFFICE_MESSAGE_NOT_FOUND",
    /** Only a person's message can become a command. */
    MessageNotHuman = "OFFICE_MESSAGE_NOT_HUMAN",
    /** The command candidate does not exist in the workspace. */
    CandidateNotFound = "OFFICE_CANDIDATE_NOT_FOUND",
    /** The candidate was cancelled, so it cannot be sent. */
    CandidateCancelled = "OFFICE_CANDIDATE_CANCELLED",
    /** The candidate was already sent, so it cannot be cancelled. */
    CandidateSent = "OFFICE_CANDIDATE_SENT",
    /** Another confirmation of the candidate is still sending it. */
    CandidateInProgress = "OFFICE_CANDIDATE_IN_PROGRESS",
    /** The candidate names a module that is not in the registry. */
    ModuleUnknown = "OFFICE_MODULE_UNKNOWN",
    /** The command bus refused the command; the refusal detail rides in the params. */
    CommandRefused = "OFFICE_COMMAND_REFUSED",
    /** A page request is malformed. */
    PageInvalid = "OFFICE_PAGE_INVALID",
}

/** How each office code travels. */
export const OFFICE_ERROR_KINDS: Record<OfficeErrorCode, ErrorKind> = {
    [OfficeErrorCode.MessageNotFound]: "not-found",
    [OfficeErrorCode.MessageNotHuman]: "invalid",
    [OfficeErrorCode.CandidateNotFound]: "not-found",
    [OfficeErrorCode.CandidateCancelled]: "conflict",
    [OfficeErrorCode.CandidateSent]: "conflict",
    [OfficeErrorCode.CandidateInProgress]: "conflict",
    [OfficeErrorCode.ModuleUnknown]: "invalid",
    [OfficeErrorCode.CommandRefused]: "invalid",
    [OfficeErrorCode.PageInvalid]: "invalid",
}

/** The one error class of the office capability. */
export class OfficeError extends DomainError<OfficeErrorCode> {}
