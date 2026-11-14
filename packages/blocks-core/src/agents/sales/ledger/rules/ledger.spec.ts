import type { BookEntryRecord } from "./accounting.types"
import { CASH_KINDS, ledgerOf, openingOf } from "./ledger"

const entry = (id: string, kind: BookEntryRecord["kind"], entryDate: string, amountVnd: number): BookEntryRecord => ({
    id,
    version: "1",
    kind,
    sourceEntity: "x",
    sourceId: id,
    entryDate,
    amountVnd,
    note: id === "e1" ? null : id,
    counterparty: null,
    status: "paid",
})

describe("openingOf", () => {
    it("is the money in less the money out, and invoices and corrections move none", () => {
        expect(
            openingOf([
                { kind: "income", vnd: 10_000 },
                { kind: "expense", vnd: 3_000 },
                { kind: "reversal", vnd: 1_000 },
                { kind: "invoice", vnd: 99_000 },
                { kind: "adjustment", vnd: 5_000 },
            ]),
        ).toBe(6_000)
        expect(openingOf([])).toBe(0)
    })
})

describe("ledgerOf", () => {
    it("groups the lines by day, keeps the running balance and closes the period", () => {
        const ledger = ledgerOf(100, [
            entry("e1", "income", "2026-11-02", 50),
            entry("e2", "expense", "2026-11-02", 30),
            entry("e3", "reversal", "2026-11-04", 10),
            entry("e4", "invoice", "2026-11-04", 999),
            entry("e5", "adjustment", "2026-11-04", 999),
        ])
        expect(ledger.days.map((day) => [day.day, day.inVnd, day.outVnd, day.balanceVnd])).toEqual([
            ["2026-11-02", 50, 30, 120],
            ["2026-11-04", 0, 10, 110],
        ])
        expect(ledger.days[0]?.lines.map((line) => [line.title, line.inVnd, line.outVnd, line.balanceVnd])).toEqual([
            ["", 50, 0, 150],
            ["e2", 0, 30, 120],
        ])
        expect(ledger).toMatchObject({ openingVnd: 100, inVnd: 50, outVnd: 40, closingVnd: 110 })
    })

    it("keeps the balance when nothing moved", () => {
        expect(ledgerOf(7, [])).toEqual({ openingVnd: 7, inVnd: 0, outVnd: 0, closingVnd: 7, days: [] })
    })

    it("lists the kinds that move money", () => {
        expect(CASH_KINDS).toEqual(["income", "expense", "reversal"])
    })
})
