import { Injectable } from "@nestjs/common"
import type { BeforeApplicationShutdown, OnApplicationBootstrap } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { DEFAULT_MAX_DELIVERIES } from "./event-bus.contracts"
import type { BaseEvent, EventMessage, EventSubscriptionOptions } from "./event-bus.contracts"
import { isCorrelationId } from "./event-bus.correlation.policy"
import { InjectEventBusOptions } from "./event-bus.decorators"
import { EventBusLogEvent } from "./event-bus.log-events"
import type { EventBusOptions } from "./event-bus.options"
import type { EventConsumer, EventConsumerRegistry } from "./event-bus.port"

/** One row of event_bus_read: pgmq returns the bigint id as text. */
interface MessageRow {
    readonly msg_id: string
    readonly read_ct: number
    readonly message: unknown
}

/** One consumer: its queue `<topic>__<consumer>`, the door its deliveries go through and its delivery budget. */
export interface EventSubscription {
    /** The consumer's pgmq queue. */
    readonly queue: string
    /** The thin door the consumer's deliveries go through. */
    readonly consumer: EventConsumer<BaseEvent>
    /** The deliveries before the message moves to `<queue>__dead`. */
    readonly maxDeliveries: number
}

/** The correlation id of an envelope: its metadata when present and valid, else a safe event id; null refuses the message. */
const correlationOf = (message: unknown, eventId: string): string | null => {
    if (typeof message !== "object" || message === null || !("metadata" in message)) {
        return isCorrelationId(eventId) ? eventId : null
    }
    const metadata = message.metadata
    if (typeof metadata !== "object" || metadata === null || !("correlationId" in metadata)) return null
    return isCorrelationId(metadata.correlationId) ? metadata.correlationId : null
}

/** True for a usable business dedupe key. */
const isDedupeKey = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 256

@Injectable()
/**
 * The consuming side of the lite event bus: each consumer reads its own pgmq queue with a visibility timeout, archives a message it
 * handled, leaves a failed one to reappear, and moves one past its maxDeliveries, or malformed, to `<queue>__dead`. Delivery is at
 * least once and unordered, so the command a consumer dispatches claims (consumer, dedupeKey) in the inbox first and reads current
 * state rather than trusting the order of events (BE-EVENT-BUS-4). The loops start on application bootstrap in the app that enables
 * consumers; shutdown raises the stop flag, wakes every pause and awaits the batch in flight. It uses a plain abortable timer, not
 * `@nestjs/schedule` (R335 keeps that in platform/jobs).
 */
export class EventConsumerService implements EventConsumerRegistry, OnApplicationBootstrap, BeforeApplicationShutdown {
    private readonly subscriptions: Array<EventSubscription> = []
    private readonly abort = new AbortController()
    private loops: Promise<unknown> = Promise.resolve()

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Adds one static subscription; the registry is filled by the reactors' own modules before bootstrap. */
    subscribe<Event extends BaseEvent>(
        queue: string,
        consumer: EventConsumer<Event>,
        options: EventSubscriptionOptions = {},
    ): void {
        this.subscriptions.push({ queue, consumer, maxDeliveries: options.maxDeliveries ?? DEFAULT_MAX_DELIVERIES })
    }

    /** Starts one read loop per subscription, only in the app that enables consumers. */
    onApplicationBootstrap(): void {
        if (this.options.consumersEnabled !== true) {
            this.logger.info(EventBusLogEvent.ConsumersDisabled, { subscriptions: this.subscriptions.length })
            return
        }
        this.loops = Promise.all(this.subscriptions.map((subscription) => this.run(subscription)))
    }

    /** Stops admitting reads, wakes the pauses and waits for the batch in flight to settle. */
    async beforeApplicationShutdown(): Promise<void> {
        this.abort.abort()
        await this.loops
    }

    /** Reads one batch of the consumer's queue and settles each message in order; answers how many it read. */
    async drain(subscription: EventSubscription): Promise<number> {
        const rows = await callDbFunction<MessageRow>(this.entityManager, "public.event_bus_read", [
            subscription.queue,
            this.options.visibilitySeconds ?? 30,
            this.options.batch ?? 10,
        ])
        await eachInOrder(rows, (row) =>
            this.abort.signal.aborted
                ? Promise.resolve()
                : this.settle(subscription, { msgId: row.msg_id, readCt: row.read_ct, message: row.message }),
        )
        return rows.length
    }

    /** Polls one queue until shutdown: each pass starts only when the one before it settled, and the answer settles at the stop. */
    private run(subscription: EventSubscription): Promise<void> {
        return new Promise((stopped) => {
            const next = (): void => {
                if (this.abort.signal.aborted) {
                    stopped()
                    return
                }
                void this.poll(subscription).then(next)
            }
            next()
        })
    }

    /** One pass: drains a batch, and rests when the queue was empty or the read failed. */
    private async poll(subscription: EventSubscription): Promise<void> {
        const read = await this.drain(subscription).catch((cause: unknown) => {
            this.logger.error(EventBusLogEvent.ReadFailed, cause, { queue: subscription.queue })
            return 0
        })
        if (read === 0) await this.pause()
    }

    /** Waits `idleMs`, or less when shutdown aborts it. */
    private pause(): Promise<void> {
        return new Promise((rested) => {
            const timer = setTimeout(rested, this.options.idleMs ?? 500)
            this.abort.signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer)
                    rested()
                },
                { once: true },
            )
        })
    }

    /** The event an envelope stands for; null when it is malformed or the event class refuses one of its values. */
    private parse(subscription: EventSubscription, message: EventMessage): BaseEvent | null {
        try {
            return subscription.consumer.event.parse(message.message)
        } catch (cause) {
            this.logger.error(EventBusLogEvent.ParseFailed, cause, {
                consumer: subscription.queue,
                msgId: message.msgId,
            })
            return null
        }
    }

    private async settle(subscription: EventSubscription, message: EventMessage): Promise<void> {
        const event = this.parse(subscription, message)
        const correlationId = event === null ? null : correlationOf(message.message, event.eventId)
        if (event === null || correlationId === null || !isDedupeKey(event.payload.dedupeKey)) {
            return this.dead(subscription, message, "malformed", null)
        }
        if (message.readCt > subscription.maxDeliveries) {
            return this.dead(subscription, message, "max-deliveries", event.eventName)
        }
        try {
            await subscription.consumer.handle({
                correlationId,
                eventId: event.eventId,
                consumer: subscription.queue,
                dedupeKey: event.payload.dedupeKey,
                event,
                attempt: message.readCt,
            })
        } catch (cause) {
            this.logger.error(EventBusLogEvent.ConsumerFailed, cause, {
                consumer: subscription.queue,
                event: event.eventName,
                attempt: message.readCt,
            })
            return
        }
        await callDbFunction(this.entityManager, "public.event_bus_archive", [subscription.queue, message.msgId])
    }

    /** Moves the message to `<queue>__dead` and archives the original, in one call. */
    private async dead(
        subscription: EventSubscription,
        message: EventMessage,
        reason: string,
        eventName: string | null,
    ): Promise<void> {
        this.logger.warn(EventBusLogEvent.DeliveryDead, {
            consumer: subscription.queue,
            event: eventName,
            msgId: message.msgId,
            reason,
            attempt: message.readCt,
        })
        await callDbFunction(this.entityManager, "public.event_bus_bury", [
            subscription.queue,
            message.msgId,
            message.readCt,
            JSON.stringify(message.message),
            reason,
        ])
    }
}
