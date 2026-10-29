import { Test } from "@nestjs/testing"
import { EventsErrorCode } from "./errors/events.error"
import { ApprovalResolvedEvent } from "./approval-resolved.event"

const SUBJECT = Symbol("approval-resolved.event")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { ApprovalResolvedEvent } }],
    }).compile()
    return moduleRef.get<{ ApprovalResolvedEvent: typeof ApprovalResolvedEvent }>(SUBJECT).ApprovalResolvedEvent
}

const PAYLOAD = { requestId: "r-1", workspaceId: "ws-1", outcome: "approved", action: "send", chainStepId: "s-1" }
const ENVELOPE_PAYLOAD = { ...PAYLOAD, dedupeKey: "r-1" }

describe("ApprovalResolvedEvent", () => {
    it("keys the event by the request and reads the same envelope back", async () => {
        const Event = await build()
        const created = Event.create(PAYLOAD)

        const parsed = Event.parse({ eventId: created.eventId, payload: created.payload })

        expect(created.eventId).toBe("r-1")
        expect(created.payload).toEqual(ENVELOPE_PAYLOAD)
        expect(parsed?.payload).toEqual(created.payload)
    })

    it("keeps who decided it when present and reads a null as absent", async () => {
        const Event = await build()

        expect(Event.create({ ...PAYLOAD, decidedBy: "m-1" }).payload).toMatchObject({ decidedBy: "m-1" })
        expect(Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, decidedBy: null } })?.payload).toEqual(
            ENVELOPE_PAYLOAD,
        )
        expect(Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, decidedBy: 4 } })).toBeNull()
    })

    it("refuses an outcome outside the set when it is created and when it is read", async () => {
        const Event = await build()
        const refusal = expect.objectContaining({ code: EventsErrorCode.ValueOutsideSet, params: { field: "outcome" } })

        expect(() => Event.create({ ...PAYLOAD, outcome: "ghost" })).toThrow(refusal)
        expect(() => Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, outcome: "ghost" } })).toThrow(
            refusal,
        )
    })

    it.each([
        null,
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, outcome: 3 } },
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, requestId: " " } },
    ])("ignores the malformed envelope %j", async (envelope) => {
        const Event = await build()

        expect(Event.parse(envelope)).toBeNull()
    })
})
