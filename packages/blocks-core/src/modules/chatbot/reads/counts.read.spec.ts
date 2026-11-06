import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { CHANNEL_COUNTS, THREAD_COUNTS } from "./counts.read"

describe("the chatbot counts reads", () => {
    it("counts the conversations per status and sums them", async () => {
        const result = await THREAD_COUNTS.execute?.(memoryProvider(memoryWorld()), { channel: "zalo" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: { counts: { needs: 1, handled: 1, ai: 2, today: 0 }, total: 4 },
        })
    })

    it("counts under today the conversations that moved in the window of the day the run is at", async () => {
        const context = { ...STAFF_CONTEXT, now: new Date("2026-11-04T05:00:00.000Z") }
        const result = await THREAD_COUNTS.execute?.(memoryProvider(memoryWorld()), {}, context)
        expect(result).toEqual({
            ok: true,
            data: { counts: { needs: 1, handled: 1, ai: 2, today: 2 }, total: 4 },
        })
    })

    it("answers the same counts whatever search and channel it is given, the source narrowing them", async () => {
        const provider = memoryProvider(memoryWorld())
        for (const given of [{ q: "  Minh ", channel: "zalo" }, { q: " ", channel: "all" }, { channel: "telegram" }]) {
            expect(await THREAD_COUNTS.execute?.(provider, given, STAFF_CONTEXT)).toMatchObject({ ok: true })
        }
    })

    it("counts the conversations per channel and sums them", async () => {
        const result = await CHANNEL_COUNTS.execute?.(memoryProvider(memoryWorld()), { status: "ai" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: { counts: { zalo: 1, telegram: 1, website: 1, facebook: 1 }, total: 4 },
        })
    })

    it("take the search and the other filter of the list, never the sort or the cursor", () => {
        expect(Object.keys(THREAD_COUNTS.variables.shape).toSorted()).toEqual(["channel", "q"])
        expect(Object.keys(CHANNEL_COUNTS.variables.shape).toSorted()).toEqual(["moved", "q", "status"])
    })
})
