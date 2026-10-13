import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the lead-flows capability. */
export enum LeadFlowsErrorCode {
    /** The lead has no lead generation flow. */
    NoFlow = "LEAD_FLOWS_NO_FLOW",
    /** The flow could not be opened or saved. */
    NotStored = "LEAD_FLOWS_NOT_STORED",
    /** No connected Page can answer for the flow. */
    NoPage = "LEAD_FLOWS_NO_PAGE",
    /** The comment the step answers is not named. */
    NoComment = "LEAD_FLOWS_NO_COMMENT",
    /** Meta refused the send. */
    MetaRefused = "LEAD_FLOWS_META_REFUSED",
    /** Even the human agent tag may no longer be used (over seven days). */
    WindowClosed = "LEAD_FLOWS_WINDOW_CLOSED",
}

/** How each lead-flows code travels. */
export const LEAD_FLOWS_ERROR_KINDS: Record<LeadFlowsErrorCode, ErrorKind> = {
    [LeadFlowsErrorCode.NoFlow]: "not-found",
    [LeadFlowsErrorCode.NotStored]: "internal",
    [LeadFlowsErrorCode.NoPage]: "conflict",
    [LeadFlowsErrorCode.NoComment]: "invalid",
    [LeadFlowsErrorCode.MetaRefused]: "unavailable",
    [LeadFlowsErrorCode.WindowClosed]: "conflict",
}

/** The one error class of the lead-flows capability. */
export class LeadFlowsError extends DomainError<LeadFlowsErrorCode> {}
