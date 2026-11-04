import { Test } from "@nestjs/testing"
import { MemoryPollLimiterStore } from "./memory-poll-limiter.adapter"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MemoryPollLimiterStore] }).compile()
    return moduleRef.get(MemoryPollLimiterStore)
}

const limits = { ratePerSecond: 1, burst: 2, concurrency: 1 }
const NOW = 5_000_000

describe("MemoryPollLimiterStore take", () => {
    it("keeps one bucket per key", async () => {
        const store = await build()

        const results = [
            await store.take("sepay:c-1", limits, NOW),
            await store.take("sepay:c-1", limits, NOW),
            await store.take("sepay:c-1", limits, NOW),
            await store.take("sepay:c-2", limits, NOW),
        ]

        expect(results.map((result) => result.allowed)).toEqual([true, true, false, true])
        expect(results[2]?.waitMs).toBe(1000)
    })
})

describe("MemoryPollLimiterStore slots", () => {
    it("grants no more slots than the cap and frees one when it is given back", async () => {
        const store = await build()

        await expect(store.enter("sepay", "c-1", 1, 1000, NOW)).resolves.toBe(true)
        await expect(store.enter("sepay", "c-2", 1, 1000, NOW)).resolves.toBe(false)
        await store.leave("sepay", "c-1")
        await expect(store.enter("sepay", "c-2", 1, 1000, NOW)).resolves.toBe(true)
    })

    it("frees the slot of a holder whose lease ran out", async () => {
        const store = await build()
        await store.enter("sepay", "c-1", 1, 1000, NOW)

        await expect(store.enter("sepay", "c-2", 1, 1000, NOW + 1001)).resolves.toBe(true)
    })

    it("keeps the slots of each provider apart and ignores a leave nobody holds", async () => {
        const store = await build()
        await store.enter("sepay", "c-1", 1, 1000, NOW)

        await expect(store.enter("zalo_oa", "c-2", 1, 1000, NOW)).resolves.toBe(true)
        await expect(store.leave("unknown", "c-9")).resolves.toBeUndefined()
    })
})
