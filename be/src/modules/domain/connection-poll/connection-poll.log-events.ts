/** Log events of the generic connection poll. */
export enum ConnectionPollLogEvent {
    /** The poll stored items the provider webhook never delivered: the webhook is missing deliveries. */
    MissedByWebhook = "connection_poll.missed_by_webhook",
    /** A connection was left out of a poll (no token, no account, test environment). */
    Skipped = "connection_poll.skipped",
    /** The poll of one connection failed; the run goes on with the next. */
    Failed = "connection_poll.failed",
    /** One poll run finished. */
    Done = "connection_poll.done",
}
