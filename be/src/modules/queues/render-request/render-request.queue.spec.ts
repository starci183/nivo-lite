import { Test } from "@nestjs/testing"
import { RENDER_REQUEST_QUEUE, renderRequestPayloadOf } from "./render-request.queue"

const PAYLOAD_READER = Symbol("renderRequestPayloadOf")

describe("renderRequestPayloadOf", () => {
    let readPayload: typeof renderRequestPayloadOf

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: PAYLOAD_READER, useValue: renderRequestPayloadOf }],
        }).compile()

        readPayload = moduleRef.get<typeof renderRequestPayloadOf>(PAYLOAD_READER)
    })

    it("declares the render request queue", () => {
        expect(RENDER_REQUEST_QUEUE).toBe("render_request")
    })

    it("returns null when the payload names no command", () => {
        expect(readPayload({})).toBeNull()
    })

    it.each([
        { commandId: undefined },
        { commandId: null },
        { commandId: 42 },
        { commandId: false },
        { commandId: {} },
        { commandId: [] },
    ])("returns null for a non-string command ID $commandId", (payload) => {
        expect(readPayload(payload)).toBeNull()
    })

    it.each(["command-1", ""])("reads the string command ID %s and only its field", (commandId) => {
        expect(readPayload({ commandId, attempt: 2 })).toEqual({ commandId })
    })
})
