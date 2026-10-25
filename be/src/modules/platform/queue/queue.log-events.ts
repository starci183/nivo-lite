/** Log events of the queues. */
export enum QueueLogEvent {
    /** The workers are off (QUEUE_ENABLED=0): jobs wait in the outbox and nothing opens a Redis connection. */
    ConsumerDisabled = "queue.consumer.disabled",
    /** A relay pass failed before it could hand the committed rows to the broker; the rows stay waiting. */
    RelayFailed = "queue.relay.failed",
    /** The reconciliation of nonterminal rows against the broker failed; the next pass retries it. */
    ReconcileFailed = "queue.reconcile.failed",
    /** A worker could not admit a delivery against the durable record; the broker retries it. */
    ReadFailed = "queue.read.failed",
    /** A delivery failed and the broker retries it after a backoff. */
    DeliveryFailed = "queue.delivery.failed",
    /** A delivery failed for good (attempts used up or an unrecoverable error); the row ends failed and the job is not retried. */
    DeadLettered = "queue.delivery.dead-lettered",
    /** The failure hook of a handler threw; the job ends failed anyway. */
    FailureHookFailed = "queue.delivery.failure-hook-failed",
    /** A delivery could not be admitted, closed or rescheduled on the durable record. */
    SettleFailed = "queue.delivery.settle-failed",
    /** The workspace slot of a running delivery could not be renewed. */
    TouchFailed = "queue.delivery.touch-failed",
    /** A delivery was aborted by the shutdown and handed back. */
    HandedBack = "queue.delivery.handed-back",
}
