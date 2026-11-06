import { ledgerOf } from "./ledger"
import { bandOf, ledgerCardOf, ledgerRecord, sectionsOf } from "./ledger-view"

const LEDGER = ledgerOf(1_000, [
    {
        id: "e1",
        version: "1",
        kind: "income",
        sourceEntity: "x",
        sourceId: "e1",
        entryDate: "2026-11-03",
        amountVnd: 500,
        note: "Anh Khoa",
    },
    {
        id: "e2",
        version: "1",
        kind: "expense",
        sourceEntity: "x",
        sourceId: "e2",
        entryDate: "2026-11-03",
        amountVnd: 200,
        note: null,
    },
])

const clean = (text: string): string => text.replace(/\s/g, " ")

describe("bandOf", () => {
    it("shows the opening balance, the money in and out and the closing balance as dong", () => {
        const cells = bandOf(LEDGER, { opening: "Open", income: "In", expense: "Out", closing: "Close" })
        expect(cells.map((cell) => [cell.id, cell.term, clean(cell.value)])).toEqual([
            ["opening", "Open", "1.000 ₫"],
            ["in", "In", "500 ₫"],
            ["out", "Out", "200 ₫"],
            ["closing", "Close", "1.300 ₫"],
        ])
    })
})

describe("sectionsOf", () => {
    it("draws each day with its lines, leaving blank the side a line did not touch and naming a line by its kind", () => {
        const [day] = sectionsOf(LEDGER, (kind) => `kind:${kind}`)
        expect(day?.day).toBe("03/11")
        expect(clean(day?.balance ?? "")).toBe("1.300 ₫")
        expect(day?.rows.map((row) => [row.title, clean(row.income), clean(row.expense), clean(row.balance)])).toEqual([
            ["Anh Khoa", "500 ₫", "", "1.500 ₫"],
            ["kind:expense", "", "200 ₫", "1.300 ₫"],
        ])
    })
})

describe("ledgerRecord", () => {
    it("takes the cash book the read answers and refuses a line of an unknown kind", () => {
        expect(ledgerRecord.safeParse(LEDGER).success).toBe(true)
        const broken = { ...LEDGER, days: [{ ...LEDGER.days[0], lines: [{ ...LEDGER.days[0]?.lines[0], kind: "x" }] }] }
        expect(ledgerRecord.safeParse(broken).success).toBe(false)
    })
})

describe("ledgerCardOf", () => {
    it("says what moved in words, in and out, and leaves the side that did not move out", () => {
        const [day] = sectionsOf(LEDGER, (kind) => kind)
        const [income, expense] = (day?.rows ?? []).map((row) => ledgerCardOf(row, { income: "In", expense: "Out" }))
        expect(clean(income?.description ?? "")).toBe("In 500 ₫")
        expect(clean(expense?.description ?? "")).toBe("Out 200 ₫")
        expect(clean(expense?.balance ?? "")).toBe("1.300 ₫")
    })

    it("has an empty line for a row that moved nothing", () => {
        expect(
            ledgerCardOf(
                { id: "x", title: "t", income: "", expense: "", balance: "b" },
                { income: "In", expense: "Out" },
            ).description,
        ).toBe("")
    })
})
