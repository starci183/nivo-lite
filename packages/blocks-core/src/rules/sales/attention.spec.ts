import { awaitingRowsOf, failedRowsOf } from "./attention"

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

    it("leaves the time empty when it is not known", () => {
        expect(awaitingRowsOf([{ id: "l1", contactName: "Lan", need: "", awaitingSince: null }])[0]?.at).toBe("")
    })
})

describe("failedRowsOf", () => {
    const ORDER = {
        id: "o1",
        orderNo: "DH-1",
        items: "2 x tea",
        amountVnd: 960_000,
        createdAt: "2026-11-04T08:30:00.000Z",
    }

    it("lists each order with its customer, its items and its amount", () => {
        expect(failedRowsOf([ORDER], { o1: "Lan" })).toEqual([
            {
                id: "o1",
                title: "DH-1 \u00b7 Lan",
                description: "2 x tea \u00b7 960.000\u00a0\u20ab",
                reason: "failed_step",
                at: "2026-11-04T08:30:00.000Z",
            },
        ])
    })

    it("names the order by its number alone when the customer is unknown", () => {
        expect(failedRowsOf([{ ...ORDER, items: "", amountVnd: null }], {})[0]).toMatchObject({
            title: "DH-1",
            description: "",
        })
    })
})
