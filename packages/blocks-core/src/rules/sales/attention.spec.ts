import { awaitingRowsOf, needsRowsOf, overdueRowsOf, ownerRowsOf } from "./attention"

describe("awaitingRowsOf", () => {
    it("lists each customer who waits with what they need and since when", () => {
        expect(
            awaitingRowsOf([
                { id: "l1", contactName: "Lan", need: "Price?", awaitingSince: "2026-11-05T07:00:00.000Z" },
            ]),
        ).toEqual([
            { id: "l1", title: "Lan", description: "Price?", reason: "awaiting_reply", at: "2026-11-05T07:00:00.000Z" },
        ])
    })

    it("leaves the line empty for a customer with no need on record", () => {
        expect(
            awaitingRowsOf([
                { id: "l1", contactName: "Lan", need: null, awaitingSince: "2026-11-05T07:00:00.000Z" },
            ])[0],
        ).toMatchObject({ description: "" })
    })

    it("leaves the time empty when it is not known", () => {
        expect(awaitingRowsOf([{ id: "l1", contactName: "Lan", need: "", awaitingSince: null }])[0]?.at).toBe("")
    })
})

describe("overdueRowsOf", () => {
    it("lists each deal with its next step and the day it was due", () => {
        expect(
            overdueRowsOf([
                { id: "l1", contactName: "Lan", nextStep: "Send quote", nextDueAt: "2026-11-04T09:00:00.000Z" },
                { id: "l2", contactName: "Binh", nextStep: null, nextDueAt: null },
            ]),
        ).toEqual([
            { id: "l1", title: "Lan", description: "Send quote", reason: "overdue", at: "2026-11-04T09:00:00.000Z" },
            { id: "l2", title: "Binh", description: "", reason: "overdue", at: "" },
        ])
    })
})

describe("needsRowsOf", () => {
    it("lists each customer with what the assistant needs and when they last changed", () => {
        expect(
            needsRowsOf([
                { id: "l1", contactName: "Lan", needs: "Phone", updatedAt: "2026-11-05T07:00:00.000Z" },
                { id: "l2", contactName: "Binh", needs: null, updatedAt: "2026-11-05T08:00:00.000Z" },
            ]),
        ).toEqual([
            { id: "l1", title: "Lan", description: "Phone", reason: "needs_reply", at: "2026-11-05T07:00:00.000Z" },
            { id: "l2", title: "Binh", description: "", reason: "needs_reply", at: "2026-11-05T08:00:00.000Z" },
        ])
    })
})

describe("ownerRowsOf", () => {
    it("names the order, its customer, its items and its amount, and why it needs a look", () => {
        expect(
            ownerRowsOf([
                { id: "o1", orderNo: "DH-1", items: "2 x tea", amountVnd: 6000000, customer: "Lan" },
                { id: "o2", orderNo: "DH-2", items: "", amountVnd: null, customer: null },
            ]),
        ).toEqual([
            {
                id: "o1",
                title: "DH-1 \u00b7 Lan",
                description: "2 x tea \u00b7 6.000.000\u00a0\u20ab",
                reason: "owner",
                at: "",
            },
            { id: "o2", title: "DH-2", description: "", reason: "owner", at: "" },
        ])
    })
})
