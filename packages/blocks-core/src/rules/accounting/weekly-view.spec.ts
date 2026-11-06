import { monthOf, weekBarsOf, weeklyRecord } from "./weekly-view"

const RECORD = { periodKey: "this", fromDay: "2026-11-01", w1: 100, w2: 0, w3: 50, w4: 0, w5: 0 } as const

describe("weekBarsOf", () => {
    it("draws four weeks, and a fifth only when it received something", () => {
        const word = (position: number): string => `T${position}`
        expect(weekBarsOf(RECORD, word).map((bar) => [bar.label, bar.value])).toEqual([
            ["T1", 100],
            ["T2", 0],
            ["T3", 50],
            ["T4", 0],
        ])
        expect(weekBarsOf({ ...RECORD, w5: 7 }, word).map((bar) => bar.label)).toEqual(["T1", "T2", "T3", "T4", "T5"])
        expect(weekBarsOf(RECORD, word)[0]?.valueLabel.replace(/\s/g, " ")).toBe("100 \u20ab")
    })
})

describe("monthOf", () => {
    it("writes month then year", () => {
        expect(monthOf("2026-11-01")).toBe("11/2026")
    })
})

describe("weeklyRecord", () => {
    it("takes the answer of the read and refuses a negative week or a bad day", () => {
        expect(weeklyRecord.safeParse(RECORD).success).toBe(true)
        expect(weeklyRecord.safeParse({ ...RECORD, w2: -1 }).success).toBe(false)
        expect(weeklyRecord.safeParse({ ...RECORD, fromDay: "soon" }).success).toBe(false)
    })
})
