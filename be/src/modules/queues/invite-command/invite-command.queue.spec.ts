import { Test } from "@nestjs/testing"
import { INVITE_COMMAND_QUEUE, inviteCommandPayloadOf } from "./invite-command.queue"

const PAYLOAD_READER = Symbol("inviteCommandPayloadOf")

describe("inviteCommandPayloadOf", () => {
    let readPayload: typeof inviteCommandPayloadOf

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: PAYLOAD_READER, useValue: inviteCommandPayloadOf }],
        }).compile()

        readPayload = moduleRef.get<typeof inviteCommandPayloadOf>(PAYLOAD_READER)
    })

    it("declares the invitation command queue", () => {
        expect(INVITE_COMMAND_QUEUE).toBe("invite_command")
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
