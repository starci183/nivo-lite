import type { MessageRecord } from "../chatbot.types"
import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { PROPOSALS } from "./proposals.read"

const PROPOSED: MessageRecord = {
    id: "p1",
    version: "1",
    conversationId: "c1",
    role: "agent",
    text: "Yes, covered.",
    sentAt: "2026-11-05T02:00:00.000Z",
    authorKind: "ai",
    authorName: null,
    authorUserId: null,
    status: "proposed",
    deliveryStatus: null,
    deliveryError: null,
}

describe("the chatbot.proposals read", () => {
    it("gives the reply the AI proposed with what the customer asked", async () => {
        const world = memoryWorld()
        world.lines.push(PROPOSED)
        const result = await PROPOSALS.execute?.(memoryProvider(world), { threadId: "c1" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: {
                id: "p1",
                asked: "Ch\u1eadu n\u00e0y c\u00f3 b\u1ea3o h\u00e0nh r\u1ec5 kh\u00f4ng \u1ea1?",
                text: "Yes, covered.",
                note: "",
            },
        })
    })

    it("gives nothing when no reply waits or the conversation is gone", async () => {
        const world = memoryWorld()
        expect(await PROPOSALS.execute?.(memoryProvider(world), { threadId: "c1" }, STAFF_CONTEXT)).toEqual({
            ok: true,
            data: null,
        })
        world.lines.push({ ...PROPOSED, conversationId: "gone" })
        expect(await PROPOSALS.execute?.(memoryProvider(world), { threadId: "gone" }, STAFF_CONTEXT)).toEqual({
            ok: true,
            data: null,
        })
    })

    it("is read with the view permission", () => {
        expect(PROPOSALS.permission).toBe("chatbot.view")
    })
})
