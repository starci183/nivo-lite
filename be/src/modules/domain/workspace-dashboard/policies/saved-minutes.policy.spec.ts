import { Test } from "@nestjs/testing"
import {
    DEFAULT_MINUTES,
    minutesSavedBy as realMinutesSavedBy,
    savingLinesOf as realSavingLinesOf,
} from "./saved-minutes.policy"

const SUBJECT = Symbol("saved-minutes.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    minutesSavedBy: realMinutesSavedBy,
                    savingLinesOf: realSavingLinesOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        minutesSavedBy: typeof realMinutesSavedBy
        savingLinesOf: typeof realSavingLinesOf
    }>(SUBJECT)
}

describe("DEFAULT_MINUTES", () => {
    it("is a positive whole number of minutes", () => {
        expect(Number.isInteger(DEFAULT_MINUTES)).toBe(true)
        expect(DEFAULT_MINUTES).toBeGreaterThan(0)
    })
})

describe("minutesSavedBy", () => {
    it("sums the finished items, each worth the default", async () => {
        const policy = await build()

        expect(
            policy.minutesSavedBy([
                { action: "first_action", count: 10 },
                { action: "second_action", count: 2 },
            ]),
        ).toBe(12 * DEFAULT_MINUTES)
    })

    it("is zero for nothing finished", async () => {
        const policy = await build()

        expect(policy.minutesSavedBy([])).toBe(0)
    })
})

describe("savingLinesOf", () => {
    it("merges an action that appears for several agents and puts the largest saving first", async () => {
        const policy = await build()

        const lines = policy.savingLinesOf([
            { action: "first_action", count: 10 },
            { action: "second_action", count: 3 },
            { action: "first_action", count: 5 },
            { action: "third_action", count: 0 },
        ])

        expect(lines).toEqual([
            { action: "first_action", count: 15, minutesEach: DEFAULT_MINUTES },
            { action: "second_action", count: 3, minutesEach: DEFAULT_MINUTES },
        ])
    })

    it("keeps at most eight lines", async () => {
        const policy = await build()

        const many = Array.from({ length: 12 }, (_, index) => ({ action: `action_${index}`, count: 1 }))

        expect(policy.savingLinesOf(many)).toHaveLength(8)
    })
})
