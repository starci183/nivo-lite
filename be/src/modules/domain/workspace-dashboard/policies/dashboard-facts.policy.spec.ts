import { Test } from "@nestjs/testing"
import {
    numberOf as realNumberOf,
    comparedOf as realComparedOf,
    rateOf as realRateOf,
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
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        numberOf: typeof realNumberOf
        comparedOf: typeof realComparedOf
        rateOf: typeof realRateOf
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
