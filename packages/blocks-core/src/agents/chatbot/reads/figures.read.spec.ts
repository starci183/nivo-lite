import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { FIGURES } from "./figures.read"

describe("the blocks-core.chatbot.api.chat.figures read", () => {
    it("counts the conversations per status, gives the share the AI answers and the engine's count of held routes", async () => {
        const world = memoryWorld()
        const result = await FIGURES.execute?.(memoryProvider(world), {}, STAFF_CONTEXT)
        // R45: the held figure is back, from the engine's route holds (`platform.route-holds` `held`), never a stored mark: 3 of 4 wait on
        // no person, and the world's holds are counted as the engine counts them.
        expect(result).toEqual({ ok: true, data: { total: 4, aiShare: 0.75, needsCount: 1, heldCount: world.holds.size } })
    })

    it("is read with the view permission", () => {
        expect(FIGURES.permission).toBe("chatbot.view")
    })
})
