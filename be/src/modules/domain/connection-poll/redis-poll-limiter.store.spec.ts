import type { PollRedis } from "./poll-limiter.contracts"
import { RedisPollLimiterStore } from "./redis-poll-limiter.store"

const limits = { ratePerSecond: 2, burst: 4, concurrency: 1 }
const NOW = 7_000_000

const build = (reply: unknown) => {
    const redis: PollRedis & { eval: jest.Mock } = { eval: jest.fn().mockResolvedValue(reply) }
    return { redis, store: new RedisPollLimiterStore(redis, "nivo") }
}

describe("RedisPollLimiterStore take", () => {
    it("runs the bucket script on the key of the connection with the rate, the burst and the time", async () => {
        const { redis, store } = build([1, 0])

        await expect(store.take("sepay:c-1", limits, NOW)).resolves.toEqual({ allowed: true, waitMs: 0 })

        expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("HMGET"), 1, "nivo:poll:bucket:sepay:c-1", 2, 4, NOW, 3_600_000)
    })

    it("answers the wait the script names when the bucket is empty", async () => {
        const { store } = build([0, 500])

        await expect(store.take("sepay:c-1", limits, NOW)).resolves.toEqual({ allowed: false, waitMs: 500 })
    })

    it.each([
        ["a reply that is not a list", "ok"],
        ["a list with one number", [1]],
        ["an empty list", []],
    ])("denies the call for a second on %s rather than letting a burst through", async (_name, reply) => {
        const { store } = build(reply)

        await expect(store.take("sepay:c-1", limits, NOW)).resolves.toEqual({ allowed: false, waitMs: 1000 })
    })
})

describe("RedisPollLimiterStore slots", () => {
    it("takes a slot with the cap and the lease and reads 1 as granted", async () => {
        const { redis, store } = build(1)

        await expect(store.enter("sepay", "c-1", 2, 60_000, NOW)).resolves.toBe(true)

        expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("ZCARD"), 1, "nivo:poll:slots:sepay", NOW, 2, 60_000, "c-1")
    })

    it("reads 0 as full", async () => {
        const { store } = build(0)

        await expect(store.enter("sepay", "c-1", 2, 60_000, NOW)).resolves.toBe(false)
    })

    it("gives the slot back by removing the member", async () => {
        const { redis, store } = build(1)

        await store.leave("sepay", "c-1")

        expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("ZREM"), 1, "nivo:poll:slots:sepay", "c-1")
    })
})
