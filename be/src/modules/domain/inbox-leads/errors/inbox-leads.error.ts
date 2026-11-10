import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the inbox-leads capability. */
export enum InboxLeadsErrorCode {
    /** The customer does not exist in the workspace. */
    LeadNotFound = "INBOX_LEADS_LEAD_NOT_FOUND",
    /** The agent is not an agent of the workspace. */
    AgentUnknown = "INBOX_LEADS_AGENT_UNKNOWN",
    /** The engine did not make the write: the record moved under it, or a rule of its entity refused it. */
    WriteRefused = "INBOX_LEADS_WRITE_REFUSED",
    /** Only an owner or a manager may change the website intake. */
    Forbidden = "INBOX_LEADS_FORBIDDEN",
    /** The website key names no website of any workspace. */
    SiteUnknown = "INBOX_LEADS_SITE_UNKNOWN",
    /** The website exists but the owner has not switched its intake on. */
    SiteOff = "INBOX_LEADS_SITE_OFF",
    /** The visitor sent neither a phone, an email nor a message. */
    SubmissionEmpty = "INBOX_LEADS_SUBMISSION_EMPTY",
}

/** How each inbox-leads code travels. */
export const INBOX_LEADS_ERROR_KINDS: Record<InboxLeadsErrorCode, ErrorKind> = {
    [InboxLeadsErrorCode.LeadNotFound]: "not-found",
    [InboxLeadsErrorCode.AgentUnknown]: "invalid",
    [InboxLeadsErrorCode.WriteRefused]: "conflict",
    [InboxLeadsErrorCode.Forbidden]: "forbidden",
    [InboxLeadsErrorCode.SiteUnknown]: "not-found",
    [InboxLeadsErrorCode.SiteOff]: "unavailable",
    [InboxLeadsErrorCode.SubmissionEmpty]: "invalid",
}

/** The one error class of the inbox-leads capability. */
export class InboxLeadsError extends DomainError<InboxLeadsErrorCode> {}
