import { Test } from "@nestjs/testing"
import { EventsErrorCode } from "./errors/events.error"
import { AiGenerationCompletedEvent } from "./ai-generation-completed.event"

const SUBJECT = Symbol("ai-generation-completed.event")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { AiGenerationCompletedEvent } }],
    }).compile()
    return moduleRef.get<{ AiGenerationCompletedEvent: typeof AiGenerationCompletedEvent }>(SUBJECT)
        .AiGenerationCompletedEvent
}

const PAYLOAD = { generationId: "g-1", workspaceId: "ws-1", purpose: "reply", status: "done" }
const ENVELOPE_PAYLOAD = { ...PAYLOAD, dedupeKey: "g-1" }

describe("AiGenerationCompletedEvent", () => {
    it("keys the event by the generation and reads the same envelope back", async () => {
        const Event = await build()
        const created = Event.create(PAYLOAD)

        const parsed = Event.parse({ eventId: created.eventId, payload: created.payload })

        expect(created.eventId).toBe("g-1")
        expect(created.payload).toEqual(ENVELOPE_PAYLOAD)
        expect(parsed?.payload).toEqual(created.payload)
    })

    it("refuses a status outside the set when it is created and when it is read", async () => {
        const Event = await build()
        const refusal = expect.objectContaining({ code: EventsErrorCode.ValueOutsideSet, params: { field: "status" } })

        expect(() => Event.create({ ...PAYLOAD, status: "ghost" })).toThrow(refusal)
        expect(() => Event.parse({ eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, status: "ghost" } })).toThrow(
            refusal,
        )
    })

    it.each([
        null,
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, status: 3 } },
        { eventId: "e-1", payload: { ...ENVELOPE_PAYLOAD, generationId: " " } },
    ])("ignores the malformed envelope %j", async (envelope) => {
        const Event = await build()

        expect(Event.parse(envelope)).toBeNull()
    })
})
