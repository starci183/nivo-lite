import {
    closeKindOf,
    dayFiguresOf,
    dayWindowOf,
    daysOfMonthUpTo,
    nextDayOf,
    reconcileMonth,
} from "./close-report"
import type { BankCredit, BookedCredit, CreditRow } from "./close-report"

const credit = (changes: Partial<CreditRow>): CreditRow => ({
    amountVnd: 100_000,
    occurredAt: "2026-11-09T03:00:00.000Z",
    status: "matched",
    orderId: "order-1",
    ...changes,
})

describe("the shop day", () => {
    it("starts at midnight in Vietnam, seven hours before midnight UTC", () => {
        expect(dayWindowOf("2026-11-09")).toEqual({
            since: "2026-11-08T17:00:00.000Z",
            until: "2026-11-09T16:59:59.999Z",
        })
    })

    it("steps over the end of a month and a year", () => {
        expect(nextDayOf("2026-11-30")).toBe("2026-12-01")
        expect(nextDayOf("2026-12-31")).toBe("2027-01-01")
        expect(nextDayOf("2028-02-28")).toBe("2028-02-29")
    })

    it("lists the days of the month up to a day", () => {
        expect(daysOfMonthUpTo("2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"])
    })
})

describe("which close a clock slot is", () => {
    const slot = (iso: string): number => Date.parse(iso)

    it("is the daily report on an ordinary evening", () => {
        expect(closeKindOf(slot("2026-11-09T14:05:00.000Z"))).toBe("daily")
    })

    it("is the month-end on the last evening of the month, in Vietnam time", () => {
        expect(closeKindOf(slot("2026-11-30T14:05:00.000Z"))).toBe("month-end")
        expect(closeKindOf(slot("2026-12-31T14:00:00.000Z"))).toBe("month-end")
        expect(closeKindOf(slot("2028-02-29T14:00:00.000Z"))).toBe("month-end")
    })

    it("counts 21:00 in Vietnam as the same shop day even when UTC is still the day before the first", () => {
        expect(closeKindOf(slot("2026-10-31T14:00:00.000Z"))).toBe("month-end")
        expect(closeKindOf(slot("2026-11-01T14:00:00.000Z"))).toBe("daily")
    })
})

describe("the figures of a day", () => {
    const rows: ReadonlyArray<CreditRow> = [
        credit({ amountVnd: 480_000 }),
        credit({ amountVnd: 150_000, orderId: "order-2" }),
        credit({ amountVnd: 70_000, status: "unmatched", orderId: null }),
        credit({ amountVnd: 30_000, status: "other_income", orderId: null }),
        credit({ amountVnd: 999_000, occurredAt: "2026-11-08T03:00:00.000Z" }),
        credit({ amountVnd: 5_000, occurredAt: "2026-11-08T17:30:00.000Z", status: "needs_review", orderId: null }),
    ]

    it("adds the money in, counts the orders paid and the credits still waiting, for that shop day only", () => {
        expect(dayFiguresOf("2026-11-09", rows, null)).toEqual({
            day: "2026-11-09",
            inVnd: 730_000 + 5_000,
            creditCount: 5,
            paidOrders: 2,
            unmatchedCount: 2,
            unmatchedVnd: 75_000,
            bankInVnd: null,
            differenceVnd: null,
        })
    })

    it("shows the difference between the bank and what is recorded when the bank can be asked", () => {
        const figures = dayFiguresOf("2026-11-09", rows, 800_000)
        expect(figures.bankInVnd).toBe(800_000)
        expect(figures.differenceVnd).toBe(800_000 - 735_000)
    })

    it("is all zero on a day with no money", () => {
        expect(dayFiguresOf("2026-11-10", rows, 0)).toMatchObject({ inVnd: 0, paidOrders: 0, unmatchedCount: 0, differenceVnd: 0 })
    })
})

describe("the month-end reconciliation", () => {
    const bank: ReadonlyArray<BankCredit> = [
        { ref: "b1", amountVnd: 480_000, occurredAt: "2026-11-02T03:00:00.000Z" },
        { ref: "b2", amountVnd: 150_000, occurredAt: "2026-11-03T03:00:00.000Z" },
        { ref: "b3", amountVnd: 70_000, occurredAt: "2026-11-04T03:00:00.000Z" },
        { ref: "b4", amountVnd: 30_000, occurredAt: "2026-11-05T03:00:00.000Z" },
        { ref: "b5", amountVnd: 200_000, occurredAt: "2026-11-01T03:00:00.000Z" },
    ]
    const booked = new Map<string, BookedCredit | null>([
        ["b1", { amountVnd: 480_000, status: "matched" }],
        ["b2", { amountVnd: 140_000, status: "matched" }],
        ["b3", { amountVnd: 70_000, status: "unmatched" }],
        ["b4", { amountVnd: 30_000, status: "other_income" }],
    ])

    it("totals the bank and the ledger and lists every credit behind the gap, oldest first", () => {
        const result = reconcileMonth(bank, booked)
        expect(result.bankInVnd).toBe(930_000)
        expect(result.ledgerInVnd).toBe(480_000 + 140_000 + 30_000)
        expect(result.differenceVnd).toBe(930_000 - 650_000)
        expect(result.differences.map((one) => [one.ref, one.kind])).toEqual([
            ["b5", "missing"],
            ["b2", "amount_differs"],
            ["b3", "waiting"],
        ])
    })

    it("has no difference when the books hold every credit as the bank does", () => {
        const all = new Map<string, BookedCredit | null>(bank.map((one) => [one.ref, { amountVnd: one.amountVnd, status: "matched" }]))
        expect(reconcileMonth(bank, all)).toMatchObject({ differenceVnd: 0, differences: [] })
    })

    it("is empty for a month with no credit", () => {
        expect(reconcileMonth([], new Map())).toEqual({ bankInVnd: 0, ledgerInVnd: 0, differenceVnd: 0, differences: [] })
    })
})
