import { STAFF_CONTEXT, STAFF_ID, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { DECIDE } from "./decide.action"

describe("the blocks-core.chatbot.chat-decide action", () => {
    // R43: the take-over is the engine's route hold (the chat stores no holder).
    it("takes the waiting conversation's route over for the member", async () => {
        const world = memoryWorld()
        const result = await DECIDE.execute?.(memoryProvider(world), { id: "c1", command: "handoff" }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: true, data: { heldBy: STAFF_ID } })
        expect(world.holds.get("0c0a0000-0000-4000-8000-0000000000a1")).toMatchObject({ memberId: STAFF_ID })
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
