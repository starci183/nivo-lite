/**
 * The pgmq event bus. A publisher sends a typed event (`BaseEvent`, a class of modules/events) to its topic, the event name, in the
 * transaction that changes the data; pgmq routes it to every consumer queue bound to that topic. The topics and consumer queues are
 * the literal constants of event-bus.queue.ts, `<TOPIC>_<CONSUMER>_TOPIC_QUEUE`, and the event-bus migration creates, with each
 * dead-letter queue `<queue>__dead`, and binds them.
 *
 * Publishing: inject `InjectEventBus()` and call `publish(event, manager, correlationId)` inside the transaction of the change. The
 * event payload extends `EventPayload` and carries a business `dedupeKey`.
 *
 * Reacting: a capability subscribes from its OWN module, without editing this capability or the app compose, because the registry is
 * exported by the global EventBusModule. The reactor's module injects it and subscribes one thin consumer per queue constant:
 *
 *     constructor(@InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry, private readonly door: LeadDoor) {}
 *     onModuleInit(): void {
 *         this.consumers.subscribe(KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE, this.door)
 *     }
 *
 * The consumer's command claims `(delivery.consumer, delivery.dedupeKey)` in the inbox inside the transaction of its effect. The
 * runner starts after every module initialised, archives a handled message, leaves a failed one to reappear after the visibility
 * timeout, and buries one past `maxDeliveries` (default 5) in `<queue>__dead`, which `deadLetters` and `requeue` read and replay.
 */
export { EVENT_BUS_ERROR_KINDS } from "./errors/event-bus.error"
export { EVENT_BUS_MESSAGES } from "./messages/event-bus.messages"
export { BaseEvent } from "./event-bus.contracts"
export type { EventDelivery, EventPayload, ParsedEvent } from "./event-bus.contracts"
export { EVENT_BUS, InjectEventBus, InjectEventConsumerRegistry } from "./event-bus.decorators"
export { EventBusModule } from "./event-bus.module"
export { EventBusService } from "./event-bus.service"
export { EventConsumerService } from "./event-consumer.service"
export type { EventBusOptions } from "./event-bus.options"
export type { EventBus, EventConsumer, EventConsumerRegistry } from "./event-bus.port"
export {
    APPROVAL_RESOLVED_AGENT_GRAPHS_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE,
    INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE,
    CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE,
    CONNECTION_READY_ZALO_INBOX_POLL_TOPIC_QUEUE,
} from "./event-bus.queue"
