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
    /** The scheduler tick finished for one provider: calls, 429s, auth failures, items found, items the webhook missed and lag ride in the fields. */
    Metrics = "connection_poll.metrics",
    /** A poll waited for the provider's rate limit and was planned again. */
    Deferred = "connection_poll.deferred",
    /** The circuit breaker of a connection opened; the failure class rides in the fields. */
    BreakerOpened = "connection_poll.breaker_opened",
    /** The provider's plan lacks the capability: the connection is tried again rarely and the owner was told once. */
    Unavailable = "connection_poll.unavailable",
    /** The provider refused the credential: polling stopped and the owner was asked to connect again. */
    NeedsReauth = "connection_poll.needs_reauth",
}
