import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BaseEvent } from "./event-bus.contracts"
import type { EventDelivery, ParsedEvent } from "./event-bus.contracts"
import { EventBusError, EventBusErrorCode } from "./errors/event-bus.error"
import { EventBusLogEvent } from "./event-bus.log-events"
import { EVENT_BUS_OPTIONS } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import type { EventConsumer } from "./event-bus.port"
import { EventConsumerService } from "./event-consumer.service"

// The statements callDbFunction of platform/database sends for the bus functions of the migration.
const READ = 'SELECT * FROM "public"."event_bus_read"($1, $2, $3)'
const ARCHIVE = 'SELECT * FROM "public"."event_bus_archive"($1, $2)'
const BURY = 'SELECT * FROM "public"."event_bus_bury"($1, $2, $3, $4, $5)'
const QUEUE = "spec_delivery_recorded__mailer"

/** The payload of the spec event. */
interface ReceiptPayload {
    readonly dedupeKey: string
    readonly receiptId: string
}

class ReceiptRecordedEvent extends BaseEvent {
    static readonly eventName = "spec.delivery-recorded"
    static readonly version = 1
    readonly eventName = ReceiptRecordedEvent.eventName

    constructor(
        readonly eventId: string,
        readonly payload: ReceiptPayload,
    ) {
        super()
    }

    static parse(envelope: unknown): ParsedEvent<ReceiptRecordedEvent> {
        if (
            typeof envelope !== "object" ||
            envelope === null ||
            !("eventId" in envelope) ||
            typeof envelope.eventId !== "string"
        )
            return null
        if (
            !("payload" in envelope) ||
            typeof envelope.payload !== "object" ||
            envelope.payload === null ||
            !("dedupeKey" in envelope.payload)
        )
            return null
        const dedupeKey = envelope.payload.dedupeKey
        return typeof dedupeKey === "string"
            ? new ReceiptRecordedEvent(envelope.eventId, { dedupeKey, receiptId: dedupeKey })
            : null
    }
}

/** An event whose parser accepts any message, so the envelope check behind the parser can be reached with a message that is no object. */
class AnyMessageEvent extends BaseEvent {
    static readonly eventName = "spec.any-message"
    static readonly version = 1
    readonly eventName = AnyMessageEvent.eventName
    readonly eventId = "event-9"
    readonly payload = { dedupeKey: "any-1" }

    static parse(): ParsedEvent<AnyMessageEvent> {
        return new AnyMessageEvent()
    }
}

/** An event whose parser refuses the value of a field the way an event class does: by throwing. */
class RefusingEvent extends BaseEvent {
    static readonly eventName = "spec.refusing"
    static readonly version = 1
    readonly eventName = RefusingEvent.eventName
    readonly eventId = "event-8"
    readonly payload = { dedupeKey: "refusing-1" }

    static parse(): ParsedEvent<RefusingEvent> {
        throw new EventBusError({ code: EventBusErrorCode.CorrelationInvalid })
    }
}

const envelope = {
    metadata: { correlationId: "request-1" },
    eventId: "event-1",
    eventName: "spec.delivery-recorded",
    payload: { dedupeKey: "receipt-1", receiptId: "receipt-1" },
}

class RecordingConsumer implements EventConsumer<ReceiptRecordedEvent> {
    readonly event = ReceiptRecordedEvent
    readonly deliveries: Array<EventDelivery<ReceiptRecordedEvent>> = []
    failing = false

    handle(delivery: EventDelivery<ReceiptRecordedEvent>): Promise<void> {
        if (this.failing) return Promise.reject(new Error("consumer down"))
        this.deliveries.push(delivery)
        return Promise.resolve()
    }
}

const logger = mock<Logger>()

const build = async (primary: ReturnType<typeof mockEntityManager>, options: EventBusOptions = {}) => {
    const module = await Test.createTestingModule({
        providers: [
            EventConsumerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: primary },
            { provide: EVENT_BUS_OPTIONS, useValue: builder<EventBusOptions>({})(options) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return module.get(EventConsumerService)
}

describe("EventConsumerService delivery", () => {
    it("delivers a committed event once to the consumer with its inbox claim keys and archives it", async () => {
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message: envelope }]],
                [ARCHIVE, [{ event_bus_archive: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()

        await expect(subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })).resolves.toBe(1)

        expect(consumer.deliveries.map(({ event: _event, ...rest }) => rest)).toEqual([
            {
                correlationId: "request-1",
                eventId: "event-1",
                consumer: QUEUE,
                dedupeKey: "receipt-1",
                attempt: 1,
            },
        ])
        expect(consumer.deliveries[0]?.event).toBeInstanceOf(ReceiptRecordedEvent)
        expect(primary.query).toHaveBeenCalledWith(READ, [QUEUE, 30, 10])
        expect(primary.query).toHaveBeenCalledWith(ARCHIVE, [QUEUE, "1"])
    })

    it("leaves a failed delivery to reappear after its visibility timeout", async () => {
        const primary = mockEntityManager({ query: [READ, [{ msg_id: "1", read_ct: 2, message: envelope }]] })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()
        consumer.failing = true

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(primary.query).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalled()
    })

    it.each([
        ["max-deliveries", { msg_id: "1", read_ct: 4, message: envelope }],
        ["malformed", { msg_id: "1", read_ct: 1, message: { eventId: 42 } }],
        [
            "malformed",
            { msg_id: "1", read_ct: 1, message: { ...envelope, payload: { dedupeKey: " ", receiptId: "receipt-1" } } },
        ],
        ["malformed", { msg_id: "1", read_ct: 1, message: { ...envelope, metadata: { correlationId: "unsafe\nid" } } }],
    ])("moves a delivery to the consumer's dead-letter queue: %s", async (reason, row) => {
        const primary = mockEntityManager({
            query: [
                [READ, [row]],
                [BURY, [{ event_bus_bury: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 3 })

        expect(consumer.deliveries).toEqual([])
        expect(primary.query).toHaveBeenCalledWith(BURY, [QUEUE, "1", row.read_ct, JSON.stringify(row.message), reason])
    })
})

describe("EventConsumerService correlation ids", () => {
    it("falls back to the event id as the correlation id of a message with no metadata", async () => {
        const { metadata: _metadata, ...bare } = envelope
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message: bare }]],
                [ARCHIVE, [{ event_bus_archive: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(consumer.deliveries.map((delivery) => delivery.correlationId)).toEqual(["event-1"])
    })
})

describe("EventConsumerService envelopes", () => {
    it.each([null, "raw text"])("falls back to the event id for a message that is no object: %p", async (message) => {
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message }]],
                [ARCHIVE, [{ event_bus_archive: true }]],
            ],
        })
        const subject = await build(primary)
        const handled: Array<string> = []
        const consumer: EventConsumer<AnyMessageEvent> = {
            event: AnyMessageEvent,
            handle: (delivery) => {
                handled.push(delivery.correlationId)
                return Promise.resolve()
            },
        }

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(handled).toEqual(["event-9"])
        expect(primary.query).toHaveBeenCalledWith(ARCHIVE, [QUEUE, "1"])
    })

    it("buries a message with no metadata whose event id is no safe correlation id", async () => {
        const message = { eventId: "unsafe\nid", payload: { dedupeKey: "receipt-1" } }
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message }]],
                [BURY, [{ event_bus_bury: true }]],
            ],
        })
        const subject = await build(primary)

        await subject.drain({ queue: QUEUE, consumer: new RecordingConsumer(), maxDeliveries: 5 })

        expect(primary.query).toHaveBeenCalledWith(BURY, [QUEUE, "1", 1, JSON.stringify(message), "malformed"])
    })
})

describe("EventConsumerService options and budgets", () => {
    it("reads the batch size and visibility timeout the options name", async () => {
        const primary = mockEntityManager({ query: [READ, []] })
        const subject = await build(primary, { visibilitySeconds: 45, batch: 3 })

        await subject.drain({ queue: QUEUE, consumer: new RecordingConsumer(), maxDeliveries: 5 })

        expect(primary.query).toHaveBeenCalledWith(READ, [QUEUE, 45, 3])
    })

    it.each([null, {}, "text"])("buries a message whose metadata is unusable: %p", async (metadata) => {
        const message = { ...envelope, metadata }
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message }]],
                [BURY, [{ event_bus_bury: true }]],
            ],
        })
        const subject = await build(primary)

        await subject.drain({ queue: QUEUE, consumer: new RecordingConsumer(), maxDeliveries: 5 })

        expect(primary.query).toHaveBeenCalledWith(BURY, [QUEUE, "1", 1, JSON.stringify(message), "malformed"])
    })

    it("takes the default delivery budget of a subscription that names none", async () => {
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 6, message: envelope }]],
                [BURY, [{ event_bus_bury: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()
        subject.subscribe(QUEUE, consumer)

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(primary.query).toHaveBeenCalledWith(BURY, [QUEUE, "1", 6, JSON.stringify(envelope), "max-deliveries"])
    })

    it("delivers a redelivery again, leaving its dedupe to the consumer's inbox claim", async () => {
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 2, message: envelope }]],
                [ARCHIVE, [{ event_bus_archive: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(
            consumer.deliveries.map((delivery) => [delivery.consumer, delivery.dedupeKey, delivery.attempt]),
        ).toEqual([[QUEUE, "receipt-1", 2]])
    })
})

describe("EventConsumerService refused values", () => {
    it("logs an envelope the event class refuses and moves it to the dead-letter queue as malformed", async () => {
        const primary = mockEntityManager({
            query: [
                [READ, [{ msg_id: "1", read_ct: 1, message: envelope }]],
                [BURY, [{ event_bus_bury: true }]],
            ],
        })
        const subject = await build(primary)
        const consumer: EventConsumer<RefusingEvent> = { event: RefusingEvent, handle: () => Promise.resolve() }

        await subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })

        expect(logger.error).toHaveBeenCalledWith(
            EventBusLogEvent.ParseFailed,
            new EventBusError({ code: EventBusErrorCode.CorrelationInvalid }),
            {
                consumer: QUEUE,
                msgId: "1",
            },
        )
        expect(primary.query).toHaveBeenCalledWith(BURY, [QUEUE, "1", 1, JSON.stringify(envelope), "malformed"])
    })
})

describe("EventConsumerService loops", () => {
    it("reads no queue when consumers are off, whatever was subscribed", async () => {
        const primary = mockEntityManager({ query: [READ, []] })
        const subject = await build(primary)
        subject.subscribe(QUEUE, new RecordingConsumer())

        subject.onApplicationBootstrap()
        await subject.beforeApplicationShutdown()

        expect(primary.query).not.toHaveBeenCalled()
    })

    it("starts a read loop per subscription on bootstrap and stops it on shutdown, waking the idle pause", async () => {
        const primary = mockEntityManager({ query: [READ, []] })
        const subject = await build(primary, { consumersEnabled: true, idleMs: 60_000 })
        subject.subscribe(QUEUE, new RecordingConsumer())

        subject.onApplicationBootstrap()
        await new Promise((resolve) => setImmediate(resolve))
        await subject.beforeApplicationShutdown()

        expect(primary.query).toHaveBeenCalledWith(READ, [QUEUE, 30, 10])
    })

    it("logs a failed read and keeps looping until shutdown", async () => {
        const failure = new Error("database down")
        const primary = mockEntityManager({ query: [READ, []] })
        primary.query.mockRejectedValue(failure)
        const subject = await build(primary, { consumersEnabled: true })
        subject.subscribe(QUEUE, new RecordingConsumer())

        subject.onApplicationBootstrap()
        await new Promise((resolve) => setImmediate(resolve))
        await subject.beforeApplicationShutdown()

        expect(logger.error).toHaveBeenCalledWith(EventBusLogEvent.ReadFailed, failure, { queue: QUEUE })
    })

    it("settles nothing of a batch it read once shutdown was raised", async () => {
        const primary = mockEntityManager({ query: [READ, [{ msg_id: "1", read_ct: 1, message: envelope }]] })
        const subject = await build(primary)
        const consumer = new RecordingConsumer()
        await subject.beforeApplicationShutdown()

        await expect(subject.drain({ queue: QUEUE, consumer, maxDeliveries: 5 })).resolves.toBe(1)

        expect(consumer.deliveries).toEqual([])
        expect(primary.query).toHaveBeenCalledTimes(1)
    })
})
