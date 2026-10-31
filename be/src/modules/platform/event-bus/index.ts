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
 *         this.consumers.subscribe(LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, this.door)
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
    BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE,
    PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE,
    LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
    DEAL_WON_AUTOMATIONS_TOPIC_QUEUE,
    DEAL_WON_CONVERSATION_HANDBACK_TOPIC_QUEUE,
    ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE,
    ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE,
    DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE,
    APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE,
    BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE,
    AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE,
    AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE,
    INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE,
    BANK_CREDIT_BOOKED_AGENT_WAKES_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AGENT_WAKES_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE,
    INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE,
} from "./event-bus.queue"
