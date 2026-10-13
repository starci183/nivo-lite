import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { CHAT_TURN_QUEUE, ChatTurnQueue, isChatTurnPayload } from "./chat-turn.queue"
import type { ChatTurnPayload } from "./chat-turn.queue"

const turn: ChatTurnPayload = {
    kind: "turn",
    workspaceId: "ws-1",
    conversationId: "c-1",
    messageId: "m-1",
    channelEventId: "e-1",
    lookupName: true,
}

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [ChatTurnQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(ChatTurnQueue), outbox }
}

describe("ChatTurnQueue", () => {
    it("keys a turn and a delivery on the message", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const deliver: ChatTurnPayload = { ...turn, kind: "deliver", lookupName: false }

        await queue.enqueueChatTurn(turn, tx)
        await queue.enqueueChatTurn(deliver, tx)

        expect(outbox.write).toHaveBeenNthCalledWith(1, tx, CHAT_TURN_QUEUE, turn, {
            job: "chat-turn.turn",
            dedupeKey: "chat-turn.turn:m-1",
        })
        expect(outbox.write).toHaveBeenNthCalledWith(2, tx, CHAT_TURN_QUEUE, deliver, {
            job: "chat-turn.deliver",
            dedupeKey: "chat-turn.deliver:m-1",
        })
    })
})

describe("isChatTurnPayload", () => {
    it("accepts a turn or a delivery and refuses a malformed one", () => {
        expect(isChatTurnPayload(turn)).toBe(true)
        expect(isChatTurnPayload({ ...turn, kind: "deliver", lookupName: false })).toBe(true)
        expect(isChatTurnPayload(null)).toBe(false)
        expect(isChatTurnPayload("turn")).toBe(false)
        expect(isChatTurnPayload({ ...turn, kind: "other" })).toBe(false)
        expect(isChatTurnPayload({ ...turn, workspaceId: 1 })).toBe(false)
        expect(isChatTurnPayload({ ...turn, conversationId: 1 })).toBe(false)
        expect(isChatTurnPayload({ ...turn, messageId: 1 })).toBe(false)
        expect(isChatTurnPayload({ ...turn, channelEventId: 1 })).toBe(false)
        expect(isChatTurnPayload({ ...turn, lookupName: "yes" })).toBe(false)
    })
})
