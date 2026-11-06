import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { DECISIONS, DECISIONS_SHOWN } from "./decisions.read"

describe("the chatbot.decisions read", () => {
    it("asks for the conversations that wait for a person, a few at a time, and counts all of them", async () => {
        const world = memoryWorld()
        const result = await DECISIONS.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)
        expect(world.queries[0]).toMatchObject({ filters: { status: "needs" }, size: DECISIONS_SHOWN })
        expect(result).toMatchObject({ ok: true, data: { count: "1", more: null } })
    })

    it("counts none when no conversation waits for a person", async () => {
        const world = memoryWorld()
        world.conversations.splice(0)
        const result = await DECISIONS.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { count: null, rows: [] } })
    })

    it("is read with the view permission", () => {
        expect(DECISIONS.permission).toBe("chatbot.view")
    })
})
