import { STAFF_CONTEXT, memoryProvider, memoryWorld, messageApi } from "../fixtures/chatbot.memory"
import { PROPOSALS } from "./proposals.read"

const line = (status: string, text: string, sentAt: string) => ({
    conversationId: "c2",
    role: "agent",
    text,
    sentAt,
    authorKind: "ai",
    authorName: null,
    authorUserId: null,
    status,
})

describe("the chatbot.proposals read", () => {
    it("answers the newest proposed reply with what the customer asked", async () => {
        const world = memoryWorld()
        const api = messageApi(world)
        await api.insert(line("proposed", "old", "2026-11-05T01:00:00.000Z"), { conversation: "c2" })
        await api.insert(line("proposed", "new", "2026-11-05T02:00:00.000Z"), { conversation: "c2" })
        await api.insert(line("posted", "said", "2026-11-05T03:00:00.000Z"), { conversation: "c2" })
        const result = await PROPOSALS.execute?.(memoryProvider(world), { threadId: "c2" }, STAFF_CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { id: "m2", text: "new", note: "" } })
    })

    it("answers null when nothing waits, the conversation is gone, or the line is not a line", async () => {
        const world = memoryWorld()
        const run = (threadId: string) => PROPOSALS.execute?.(memoryProvider(world), { threadId }, STAFF_CONTEXT)
        expect(await run("c2")).toEqual({ ok: true, data: null })
        expect(await run("gone")).toEqual({ ok: true, data: null })
        await messageApi(world).insert({ status: "proposed", conversationId: "c2" }, { conversation: "c2" })
        expect(await run("c2")).toEqual({ ok: true, data: null })
    })
})
