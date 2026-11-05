import { ageingOf, ageingSlotOf, figuresOf } from "./figures"
import type { OpenInvoice } from "./figures"

const NOW = new Date("2026-11-04T00:00:00.000Z")
const open = (amountVnd: number, dueAt: string | null, issuedAt: string | null = null): OpenInvoice => ({
    amountVnd,
    dueAt,
    issuedAt,
    createdAt: "2026-01-01T00:00:00.000Z",
})

describe("figures", () => {
    it("puts an invoice in the bucket of its age, edges included in the younger one", () => {
        expect(ageingSlotOf(0)).toBe("d0")
        expect(ageingSlotOf(30)).toBe("d0")
        expect(ageingSlotOf(31)).toBe("d30")
        expect(ageingSlotOf(60)).toBe("d30")
        expect(ageingSlotOf(61)).toBe("d60")
    })

    it("ages open invoices since they fell due, else since their issue, else since their creation", () => {
        const ageing = ageingOf(
            [
                open(100, "2026-11-01T00:00:00.000Z"),
                open(200, null, "2026-09-24T00:00:00.000Z"),
                open(300, null, null),
                open(50, "2026-11-10T00:00:00.000Z"),
            ],
            NOW,
        )
        expect(ageing.d0).toEqual({ vnd: 150, count: 2 })
        expect(ageing.d30).toEqual({ vnd: 200, count: 1 })
        expect(ageing.d60).toEqual({ vnd: 300, count: 1 })
    })

    it("counts an invoice whose date cannot be read as new", () => {
        const ageing = ageingOf([open(70, "not a date")], NOW)
        expect(ageing.d0).toEqual({ vnd: 70, count: 1 })
    })

    it("sums the entries of a period by kind, the unmatched payments and every open invoice", () => {
        const figures = figuresOf({
            totals: [
                { kind: "income", vnd: 5_000_000, count: 1 },
                { kind: "income", vnd: 1_000_000, count: 2 },
                { kind: "invoice", vnd: 2_000_000, count: 1 },
                { kind: "adjustment", vnd: 1_800_000, count: 1 },
            ],
            unmatched: { vnd: 300_000, count: 1 },
            openInvoices: [open(2_000_000, "2026-11-01T00:00:00.000Z")],
            now: NOW,
        })
        expect(figures).toEqual({
            income: { vnd: 6_000_000, count: 3 },
            invoiced: { vnd: 2_000_000, count: 1 },
            adjustments: { vnd: 1_800_000, count: 1 },
            unmatched: { vnd: 300_000, count: 1 },
            receivable: { vnd: 2_000_000, count: 1 },
            ageing: {
                d0: { vnd: 2_000_000, count: 1 },
                d30: { vnd: 0, count: 0 },
                d60: { vnd: 0, count: 0 },
            },
        })
    })

    it("has zero figures for a period with no entries", () => {
        const none = { vnd: 0, count: 0 }
        expect(figuresOf({ totals: [], unmatched: none, openInvoices: [], now: NOW })).toEqual({
            income: none,
            invoiced: none,
            adjustments: none,
            unmatched: none,
            receivable: none,
            ageing: { d0: none, d30: none, d60: none },
        })
    })
})
