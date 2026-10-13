import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable lead action refusal codes. */
export enum LeadActionsErrorCode {
    /** Another engine worker is still preparing the selected step. */
    Busy = "LEAD_ACTIONS_BUSY",
    /** The action input is missing, malformed or outside its bounds. */
    InvalidInput = "LEAD_ACTIONS_INVALID_INPUT",
    /** The run or action target is outside the workspace or absent. */
    NotFound = "LEAD_ACTIONS_NOT_FOUND",
    /** The chosen lead has not been won. */
    NotWon = "LEAD_ACTIONS_NOT_WON",
    /** The authority engine could not complete the action. */
    WorkFailed = "LEAD_ACTIONS_WORK_FAILED",
}

/** The transport classification of lead action errors. */
export const LEAD_ACTIONS_ERROR_KINDS: Record<LeadActionsErrorCode, ErrorKind> = {
    [LeadActionsErrorCode.Busy]: "unavailable",
    [LeadActionsErrorCode.InvalidInput]: "invalid",
    [LeadActionsErrorCode.NotFound]: "not-found",
    [LeadActionsErrorCode.NotWon]: "invalid",
    [LeadActionsErrorCode.WorkFailed]: "unavailable",
}

/** The error family of the lead-actions capability. */
export class LeadActionsError extends DomainError<LeadActionsErrorCode> {}
