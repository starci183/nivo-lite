/** Log events of the queues. */
export enum QueueLogEvent {
    /** A scheduler could not be registered at boot. */
    SchedulerFailed = "queue.scheduler.failed",
    /** The workers are off (QUEUE_ENABLED=0): jobs wait in their queue. */
    ConsumerDisabled = "queue.consumer.disabled",
    /** A worker could not read its queue; it waits and reads again. */
    ReadFailed = "queue.read.failed",
    /** A delivery failed and its message becomes visible again after a backoff. */
    DeliveryFailed = "queue.delivery.failed",
    /** A delivery failed for good (attempts used up or an unrecoverable error); its message is archived and the job is not retried. */
    DeadLettered = "queue.delivery.dead-lettered",
    /** The failure hook of a handler threw; the job is archived anyway. */
    FailureHookFailed = "queue.delivery.failure-hook-failed",
    /** A message could not be acknowledged, archived or rescheduled; it reappears after its visibility timeout. */
    SettleFailed = "queue.delivery.settle-failed",
    /** The visibility timeout of a running message could not be renewed. */
    TouchFailed = "queue.delivery.touch-failed",
    /** A delivery was aborted by the shutdown and handed back. */
    HandedBack = "queue.delivery.handed-back",
}
