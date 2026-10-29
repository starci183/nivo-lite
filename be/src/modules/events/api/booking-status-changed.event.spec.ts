import { Test } from "@nestjs/testing"
import { EventsErrorCode } from "./errors/events.error"
import { BookingStatusChangedEvent } from "./booking-status-changed.event"

const SUBJECT = Symbol("booking-status-changed.event")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { BookingStatusChangedEvent } }],
    }).compile()
    return moduleRef.get<{ BookingStatusChangedEvent: typeof BookingStatusChangedEvent }>(SUBJECT)
        .BookingStatusChangedEvent
}

const PAYLOAD = { workspaceId: "ws-1", bookingId: "b-1", kind: "status", status: "confirmed" }
const ENVELOPE_PAYLOAD = { ...PAYLOAD, dedupeKey: "b-1:status:confirmed:tx-1" }

describe("BookingStatusChangedEvent", () => {
    it("keys the event by booking, kind, status and transaction", async () => {
        const Event = await build()

        const created = Event.create({ ...PAYLOAD, previous: "pending" }, "tx-1")

        expect(created.eventId).toBe("b-1:status:confirmed:tx-1")
        expect(created.payload).toEqual({ ...ENVELOPE_PAYLOAD, previous: "pending" })
    })

    it("reads an envelope whose previous status is null as one without it", async () => {
        const Event = await build()

        const parsed = Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, previous: null } })

        expect(parsed?.payload).toEqual(ENVELOPE_PAYLOAD)
        expect(
            Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, previous: "pending" } })?.payload,
        ).toMatchObject({ previous: "pending" })
    })

    it("refuses a kind outside the set when it is created and when it is read", async () => {
        const Event = await build()
        const refusal = expect.objectContaining({ code: EventsErrorCode.ValueOutsideSet, params: { field: "kind" } })

        expect(() => Event.create({ ...PAYLOAD, kind: "ghost" }, "tx-1")).toThrow(refusal)
        expect(() => Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, kind: "ghost" } })).toThrow(refusal)
    })

    it.each([
        null,
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, kind: 3 } },
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, previous: 4 } },
    ])("ignores the malformed envelope %j", async (envelope) => {
        const Event = await build()

        expect(Event.parse(envelope)).toBeNull()
    })
})
