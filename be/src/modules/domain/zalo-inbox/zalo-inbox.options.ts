/** The zalo-inbox capability: the rules of the reconcile job that reads back the messages the webhook never delivered. Every key has a default. */
export interface ZaloInboxOptions {
    /** How long after the customer's last message the OA may still reply as a consultation message (Zalo's rule: 48 hours), in milliseconds. */
    readonly replyWindowMs?: number
    /** A polled message older than this is kept for the owner instead of being answered by an agent, in milliseconds. */
    readonly staleAfterMs?: number
}
