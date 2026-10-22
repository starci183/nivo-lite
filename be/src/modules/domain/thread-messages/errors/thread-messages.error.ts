import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the thread-messages capability. */
export enum ThreadMessagesErrorCode {
    /** No message of the workspace has the requested id. */
    MessageNotFound = "THREAD_MESSAGES_MESSAGE_NOT_FOUND",
    /** No agent of the workspace has the requested id. */
    AgentNotFound = "THREAD_MESSAGES_AGENT_NOT_FOUND",
    /** The member is not an active member of the workspace. */
    MemberNotFound = "THREAD_MESSAGES_MEMBER_NOT_FOUND",
    /** A tag names an id or group that has the wrong shape. */
    MentionInvalid = "THREAD_MESSAGES_MENTION_INVALID",
    /** A tag names a member, agent or group that is not in the workspace. */
    MentionUnknown = "THREAD_MESSAGES_MENTION_UNKNOWN",
    /** A message tags more than the limit. */
    TooManyMentions = "THREAD_MESSAGES_TOO_MANY_MENTIONS",
    /** A quote is empty, too long or there are too many. */
    QuoteInvalid = "THREAD_MESSAGES_QUOTE_INVALID",
    /** The member may not give that agent work. */
    AssignNotAllowed = "THREAD_MESSAGES_ASSIGN_NOT_ALLOWED",
    /** The agent may not tag that other agent. */
    TagNotAllowed = "THREAD_MESSAGES_TAG_NOT_ALLOWED",
    /** The message carries no approval card. */
    NoApproval = "THREAD_MESSAGES_NO_APPROVAL",
    /** The member is not among the people tagged on the card. */
    NotApprover = "THREAD_MESSAGES_NOT_APPROVER",
    /** Someone already decided the card. */
    AlreadyDecided = "THREAD_MESSAGES_ALREADY_DECIDED",
    /** The card expired before anyone decided it. */
    ApprovalClosed = "THREAD_MESSAGES_APPROVAL_CLOSED",
    /** The insert answered no row: the row was not written. */
    NotStored = "THREAD_MESSAGES_NOT_STORED",
}

/** How each thread-messages code travels. */
export const THREAD_MESSAGES_ERROR_KINDS: Record<ThreadMessagesErrorCode, ErrorKind> = {
    [ThreadMessagesErrorCode.MessageNotFound]: "not-found",
    [ThreadMessagesErrorCode.AgentNotFound]: "not-found",
    [ThreadMessagesErrorCode.MemberNotFound]: "not-found",
    [ThreadMessagesErrorCode.MentionInvalid]: "invalid",
    [ThreadMessagesErrorCode.MentionUnknown]: "not-found",
    [ThreadMessagesErrorCode.TooManyMentions]: "invalid",
    [ThreadMessagesErrorCode.QuoteInvalid]: "invalid",
    [ThreadMessagesErrorCode.AssignNotAllowed]: "forbidden",
    [ThreadMessagesErrorCode.TagNotAllowed]: "forbidden",
    [ThreadMessagesErrorCode.NoApproval]: "invalid",
    [ThreadMessagesErrorCode.NotApprover]: "forbidden",
    [ThreadMessagesErrorCode.AlreadyDecided]: "conflict",
    [ThreadMessagesErrorCode.ApprovalClosed]: "conflict",
    [ThreadMessagesErrorCode.NotStored]: "internal",
}

/** The one error class of the thread-messages capability. */
export class ThreadMessagesError extends DomainError<ThreadMessagesErrorCode> {}
