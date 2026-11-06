import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { CHANNEL_COUNTS, THREAD_COUNTS } from "./counts.read"

describe("the chatbot counts reads", () => {
    it("counts the conversations per status and sums them", async () => {
        const result = await THREAD_COUNTS.execute?.(memoryProvider(memoryWorld()), { channel: "zalo" }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: true, data: { counts: { needs: 1, handled: 1, ai: 2 }, total: 4 } })
    })

    it("counts the conversations per channel and sums them", async () => {
        const result = await CHANNEL_COUNTS.execute?.(memoryProvider(memoryWorld()), { status: "ai" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: { counts: { zalo: 1, telegram: 1, website: 1, facebook: 1 }, total: 4 },
        })
    })

    it("take the search and the other filter of the list, never the sort or the cursor", () => {
        expect(Object.keys(THREAD_COUNTS.variables.shape).toSorted()).toEqual(["channel", "moved", "q"])
        expect(Object.keys(CHANNEL_COUNTS.variables.shape).toSorted()).toEqual(["moved", "q", "status"])
    })
})
