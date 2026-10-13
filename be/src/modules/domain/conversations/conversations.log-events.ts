/** Log events of the conversations capability. */
export enum ConversationsLogEvent {
    /** The AI step threw instead of answering; the turn falls back to the holding line. */
    RuntimeFailed = "conversations.runtime.failed",
    /** The conversation or message of a queued turn no longer exists; the job ends without effect. */
    TurnTargetGone = "conversations.turn.target-gone",
}
