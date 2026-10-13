import type { Locale } from "@modules/platform/i18n"

/** The progress of a queued customer reply or escalation decision. */
export type ChatReplyStatus = "queued" | "running" | "succeeded" | "failed"

/** An accepted request and the progress the frontend polls. */
export interface ChatReplyProgress {
    /** The work item or message id used by the status query. */
    readonly id: string
    /** The queued work's current progress. */
    readonly status: ChatReplyStatus
    /** The stored answer message, when available. */
    readonly messageId: string | null
    /** Whether delivery succeeded, failed, or has not yet happened. */
    readonly delivery: string | null
    /** A stable terminal failure code; never provider prose. */
    readonly errorCode: string | null
}

/** A member's own reply while the customer conversation is held. */
export interface ChatReplyRequest {
    /** The customer conversation in the selected workspace. */
    readonly conversationId: string
    /** The bounded reply text. */
    readonly body: string
    /** The language for the audit lines. */
    readonly locale: Locale
}

/** A person's answer to a waiting customer escalation; null declines it. */
export interface ChatAnswerRequest {
    /** The waiting reply_customer work item. */
    readonly workItemId: string
    /** The customer conversation that the work item names. */
    readonly conversationId: string
    /** The edited answer, or null to reject. */
    readonly text: string | null
    /** The language for decision and audit lines. */
    readonly locale: Locale
}

/** The resulting holder after a takeover or release. */
export interface ChatHandlingResult {
    /** The customer conversation. */
    readonly conversationId: string
    /** The member's name, or null when the AI handles it. */
    readonly handledBy: string | null
}

/** The conversation addressed by an escalation, or null when its address is missing. */
export type OptionalChatConversationId = string | null
