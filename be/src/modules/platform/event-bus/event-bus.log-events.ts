/** Log events of the event bus. */
export enum EventBusLogEvent {
    /** A consumer threw; the message reappears after its visibility timeout. */
    ConsumerFailed = "event-bus.consumer.failed",
    /** A delivery ran out of deliveries or was malformed and moved to its consumer's dead-letter queue. */
    DeliveryDead = "event-bus.delivery.dead",
    /** An envelope could not be read by its event class (a value outside the event's set); it moves to the dead-letter queue. */
    ParseFailed = "event-bus.parse.failed",
    /** A read of a consumer's queue failed; the loop reads again after its idle pause. */
    ReadFailed = "event-bus.read.failed",
    /** Consumers are off in this app: subscriptions are kept but no queue is read. */
    ConsumersDisabled = "event-bus.consumers.disabled",
}
