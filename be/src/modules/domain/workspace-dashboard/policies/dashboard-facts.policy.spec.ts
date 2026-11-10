import { Test } from "@nestjs/testing"
import {
    numberOf as realNumberOf,
    comparedOf as realComparedOf,
    rateOf as realRateOf,
    channelsOf as realChannelsOf,
} from "./dashboard-facts.policy"

const SUBJECT = Symbol("dashboard-facts.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    numberOf: realNumberOf,
                    comparedOf: realComparedOf,
                    rateOf: realRateOf,
                    channelsOf: realChannelsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        numberOf: typeof realNumberOf
        comparedOf: typeof realComparedOf
        rateOf: typeof realRateOf
        channelsOf: typeof realChannelsOf
    }>(SUBJECT)
}

describe("numberOf", () => {
    it("reads numbers and numeric text, and turns anything else into zero", async () => {
        const policy = await build()

        expect(policy.numberOf(12)).toBe(12)
        expect(policy.numberOf("1500000")).toBe(1_500_000)
        expect(policy.numberOf(null)).toBe(0)
        expect(policy.numberOf("abc")).toBe(0)
        expect(policy.numberOf(undefined)).toBe(0)
    })
})

describe("comparedOf", () => {
    it("pairs the period with the one before it", async () => {
        const policy = await build()

        expect(policy.comparedOf("300", null)).toEqual({ current: 300, previous: 0 })
    })
})

describe("rateOf", () => {
    it("is a share of the whole and null while there is no whole", async () => {
        const policy = await build()

        expect(policy.rateOf(34, 100)).toBe(0.34)
        expect(policy.rateOf(0, 5)).toBe(0)
        expect(policy.rateOf(0, 0)).toBeNull()
    })

    it("never passes one", async () => {
        const policy = await build()

        expect(policy.rateOf(7, 5)).toBe(1)
    })
})

describe("channelsOf", () => {
    it("merges leads and revenue, the channel with the most leads first, and drops a channel with neither", async () => {
        const policy = await build()

        const channels = policy.channelsOf(
            new Map([
                ["zalo", 21],
                ["website", 11],
                ["telegram", 0],
            ]),
            new Map([
                ["zalo", 1_900_000],
                ["facebook", 310_000],
            ]),
        )

        expect(channels).toEqual([
            { channel: "zalo", leads: 21, revenueVnd: 1_900_000 },
            { channel: "website", leads: 11, revenueVnd: 0 },
            { channel: "facebook", leads: 0, revenueVnd: 310_000 },
        ])
    })

    it("breaks ties by revenue, then by name", async () => {
        const policy = await build()

        const channels = policy.channelsOf(
            new Map([
                ["b", 2],
                ["a", 2],
                ["c", 2],
            ]),
            new Map([["c", 5]]),
        )

        expect(channels.map((facts) => facts.channel)).toEqual(["c", "a", "b"])
    })
})
