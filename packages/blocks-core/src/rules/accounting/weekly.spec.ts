import { weeklyIncomeOf } from "./weekly"

describe("weeklyIncomeOf", () => {
    it("adds the income of each week of the period and leaves out what falls outside it", () => {
        expect(
            weeklyIncomeOf(
                [
                    { entryDate: "2026-11-01", amountVnd: 10 },
                    { entryDate: "2026-11-07", amountVnd: 5 },
                    { entryDate: "2026-11-08", amountVnd: 7 },
                    { entryDate: "2026-11-30", amountVnd: 3 },
                    { entryDate: "2026-10-31", amountVnd: 99 },
                    { entryDate: "2026-12-01", amountVnd: 99 },
                ],
                "2026-11-01",
                "2026-12-01",
            ),
        ).toEqual({ w1: 15, w2: 7, w3: 0, w4: 0, w5: 3 })
    })

    it("is all zero for no entry", () => {
        expect(weeklyIncomeOf([], "2026-11-01", "2026-12-01")).toEqual({ w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 })
    })
})
