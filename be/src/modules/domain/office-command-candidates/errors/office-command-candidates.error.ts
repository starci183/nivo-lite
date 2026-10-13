import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the office capability. */
export enum OfficeCommandCandidatesErrorCode {
    /** The message does not exist in the workspace. */
    MessageNotFound = "OFFICE_COMMAND_CANDIDATES_MESSAGE_NOT_FOUND",
    /** Only a person's message can become a command. */
    MessageNotHuman = "OFFICE_COMMAND_CANDIDATES_MESSAGE_NOT_HUMAN",
    /** The command candidate does not exist in the workspace. */
    CandidateNotFound = "OFFICE_COMMAND_CANDIDATES_CANDIDATE_NOT_FOUND",
    /** The candidate was cancelled, so it cannot be sent. */
    CandidateCancelled = "OFFICE_COMMAND_CANDIDATES_CANDIDATE_CANCELLED",
    /** The candidate was already sent, so it cannot be cancelled. */
    CandidateSent = "OFFICE_COMMAND_CANDIDATES_CANDIDATE_SENT",
    /** Another confirmation of the candidate is still sending it. */
    CandidateInProgress = "OFFICE_COMMAND_CANDIDATES_CANDIDATE_IN_PROGRESS",
    /** The candidate names a module that is not in the registry. */
    ModuleUnknown = "OFFICE_COMMAND_CANDIDATES_MODULE_UNKNOWN",
    /** The command bus refused the command; the refusal detail rides in the params. */
    CommandRefused = "OFFICE_COMMAND_CANDIDATES_COMMAND_REFUSED",
    /** A page request is malformed. */
    PageInvalid = "OFFICE_COMMAND_CANDIDATES_PAGE_INVALID",
}

/** How each office code travels. */
export const OFFICE_COMMAND_CANDIDATES_ERROR_KINDS: Record<OfficeCommandCandidatesErrorCode, ErrorKind> = {
    [OfficeCommandCandidatesErrorCode.MessageNotFound]: "not-found",
    [OfficeCommandCandidatesErrorCode.MessageNotHuman]: "invalid",
    [OfficeCommandCandidatesErrorCode.CandidateNotFound]: "not-found",
    [OfficeCommandCandidatesErrorCode.CandidateCancelled]: "conflict",
    [OfficeCommandCandidatesErrorCode.CandidateSent]: "conflict",
    [OfficeCommandCandidatesErrorCode.CandidateInProgress]: "conflict",
    [OfficeCommandCandidatesErrorCode.ModuleUnknown]: "invalid",
    [OfficeCommandCandidatesErrorCode.CommandRefused]: "invalid",
    [OfficeCommandCandidatesErrorCode.PageInvalid]: "invalid",
}

/** The one error class of the office capability. */
export class OfficeCommandCandidatesError extends DomainError<OfficeCommandCandidatesErrorCode> {}
