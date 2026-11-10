import { Test } from "@nestjs/testing"
import { DEFAULT_MINUTES, SAVED_MINUTES } from "./saved-minutes.policy"
import {
    minutesOf as realMinutesOf,
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
                    minutesOf: realMinutesOf,
                    minutesSavedBy: realMinutesSavedBy,
                    savingLinesOf: realSavingLinesOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        minutesOf: typeof realMinutesOf
        minutesSavedBy: typeof realMinutesSavedBy
        savingLinesOf: typeof realSavingLinesOf
    }>(SUBJECT)
}

describe("minutesOf", () => {
    it("reads the table and falls back to the default for an action it does not list", async () => {
        const policy = await build()

        expect(policy.minutesOf("reply_customer")).toBe(SAVED_MINUTES.reply_customer)
        expect(policy.minutesOf("an_action_nobody_listed")).toBe(DEFAULT_MINUTES)
    })

    it("holds only positive whole minutes", () => {
        for (const minutes of Object.values(SAVED_MINUTES)) {
            expect(Number.isInteger(minutes)).toBe(true)
            expect(minutes).toBeGreaterThan(0)
        }
    })
})

describe("minutesSavedBy", () => {
    it("sums the count of each action times its minutes", async () => {
        const policy = await build()

        expect(
            policy.minutesSavedBy([
                { action: "reply_customer", count: 10 },
                { action: "confirm_order", count: 2 },
                { action: "an_action_nobody_listed", count: 3 },
            ]),
        ).toBe(10 * 2 + 2 * 5 + 3 * DEFAULT_MINUTES)
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
            { action: "reply_customer", count: 10 },
            { action: "confirm_order", count: 3 },
            { action: "reply_customer", count: 5 },
            { action: "send_care", count: 0 },
        ])

        expect(lines).toEqual([
            { action: "reply_customer", count: 15, minutesEach: 2 },
            { action: "confirm_order", count: 3, minutesEach: 5 },
        ])
    })

    it("keeps at most eight lines", async () => {
        const policy = await build()

        const many = Object.keys(SAVED_MINUTES).map((action) => ({ action, count: 1 }))

        expect(policy.savingLinesOf(many)).toHaveLength(8)
    })
})
