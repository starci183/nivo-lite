import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { FIGURES } from "./figures.read"

describe("the chatbot.figures read", () => {
    it("counts the conversations per status and gives the share the AI answers", async () => {
        const result = await FIGURES.execute?.(memoryProvider(memoryWorld()), {}, STAFF_CONTEXT)
        expect(result).toEqual({ ok: true, data: { total: 4, aiShare: 0.5, needsCount: 1, handledCount: 1 } })
    })

    it("is read with the view permission", () => {
        expect(FIGURES.permission).toBe("chatbot.view")
    })
})
