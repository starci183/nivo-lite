import { STAFF_CONTEXT, conversationOf, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { DECIDE } from "./decide.action"

describe("the chatbot.decide action", () => {
    it("takes the waiting conversation over under the member name", async () => {
        const world = memoryWorld()
        const result = await DECIDE.execute?.(memoryProvider(world), { id: "c1", command: "handoff" }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: true, data: { handledBy: "Thu Ha Le" } })
        expect(conversationOf(world, "c1")).toMatchObject({ handledBy: "Thu Ha Le" })
    })

    it("refuses a command it does not know", async () => {
        const result = await DECIDE.execute?.(
            memoryProvider(memoryWorld()),
            { id: "c1", command: "reply" },
            STAFF_CONTEXT,
        )
        expect(result).toMatchObject({ ok: false })
    })

    it("needs the right to reply", () => {
        expect(DECIDE.permission).toBe("chatbot.reply")
    })
})
