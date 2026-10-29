import { mock } from "@starci/jest-preset"
import { BookingStatusChangedEvent } from "@modules/events/api"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import type { BookingEffectsService } from "./booking-effects.service"
import { BookingStatusChangedConsumer } from "./booking-status-changed.consumer"

const delivery = (): EventDelivery<BookingStatusChangedEvent> => {
    const event = BookingStatusChangedEvent.create(
        { workspaceId: "ws-1", bookingId: "b-1", kind: "status", status: "done", previous: "confirmed" },
        "100",
    )
    return {
        correlationId: event.eventId,
        eventId: event.eventId,
        consumer: "booking_status_changed__booking_effects",
        dedupeKey: event.payload.dedupeKey,
        event,
        attempt: 1,
    }
}

describe("BookingStatusChangedConsumer", () => {
    const build = () => {
        const registry = mock<EventConsumerRegistry>()
        const effects = mock<BookingEffectsService>()
        effects.apply.mockResolvedValue({
            found: true,
            reminders: "none",
            feeVnd: 0,
            handedOff: false,
            notified: false,
        })
        return { registry, effects, subject: new BookingStatusChangedConsumer(registry, effects) }
    }

    it("subscribes to the booking_effects queue of booking_status_changed", () => {
        const { registry, subject } = build()

        subject.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("booking_status_changed__booking_effects", subject)
    })

    it("applies the effects of the booking with the delivery's inbox key", async () => {
        const { effects, subject } = build()

        await subject.handle(delivery())

        expect(effects.apply).toHaveBeenCalledWith(
            { workspaceId: "ws-1", bookingId: "b-1", kind: "status" },
            { consumer: "booking_status_changed__booking_effects", dedupeKey: "b-1:status:done:100" },
        )
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { effects, subject } = build()
        const cause = new Error("notice channel down")
        effects.apply.mockRejectedValue(cause)

        await expect(subject.handle(delivery())).rejects.toBe(cause)
    })
})

describe("BookingStatusChangedEvent", () => {
    it("reads the envelope the trigger sends and refuses a malformed one", () => {
        const sent = {
            metadata: { correlationId: "b-1:status:done:100" },
            eventId: "b-1:status:done:100",
            eventName: "booking_status_changed",
            payload: {
                dedupeKey: "b-1:status:done:100",
                workspaceId: "ws-1",
                bookingId: "b-1",
                kind: "status",
                status: "done",
                previous: null,
            },
        }

        expect(BookingStatusChangedEvent.parse(sent)?.payload).toEqual(sent.payload)
        expect(BookingStatusChangedEvent.parse({ ...sent, payload: { ...sent.payload, kind: "other" } })).toBeNull()
        expect(BookingStatusChangedEvent.parse({ ...sent, payload: { ...sent.payload, bookingId: 3 } })).toBeNull()
        expect(BookingStatusChangedEvent.parse(undefined)).toBeNull()
    })
})
