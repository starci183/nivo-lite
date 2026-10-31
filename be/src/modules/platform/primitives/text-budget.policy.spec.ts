import { Test } from "@nestjs/testing"
import { ellipsize, withinBudget } from "./text-budget.policy"

const SUBJECT = Symbol("text-budget.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { ellipsize, withinBudget } }],
    }).compile()
    return moduleRef.get<typeof import("./text-budget.policy")>(SUBJECT)
}

describe("text-budget.policy", () => {
    it("preserves fitting text and clips long text with a trimmed ellipsis", async () => {
        const subject = await build()

        expect(subject.ellipsize("Tea", 3)).toBe("Tea")
        expect(subject.ellipsize("Tea", 4)).toBe("Tea")
        expect(subject.ellipsize("Tea   menu", 6)).toBe("Tea…")
        expect(subject.ellipsize("Tea", 1)).toBe("…")
    })

    it("takes fitting lines in order and stops before the first oversized line", async () => {
        const subject = await build()

        expect(subject.withinBudget(["Tea", "Milk", "x"], 7)).toEqual(["Tea", "Milk"])
        expect(subject.withinBudget(["too long", "x"], 1)).toEqual([])
        expect(subject.withinBudget([], 0)).toEqual([])
    })
})
