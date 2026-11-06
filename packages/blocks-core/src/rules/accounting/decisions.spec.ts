import { unmatchedQueueOf } from "./decisions"

const PAID = {
    id: "t1",
    amountVnd: 3_500_000,
    reference: "CK HOA SEN",
    payer: "Hoa Sen",
    occurredAt: "2026-11-04T02:12:00.000Z",
}
const BARE = { id: "t2", amountVnd: 100, reference: null, payer: null, occurredAt: "2026-11-04T02:12:00.000Z" }

describe("unmatchedQueueOf", () => {
    it("draws each payment with its payer, its transfer content and its amount, and no command to run", () => {
        const queue = unmatchedQueueOf([PAID, BARE], 5)
        expect(queue.count).toBe("5")
        expect(queue.rows[0]).toMatchObject({
            title: "Hoa Sen",
            description: "CK HOA SEN",
            amount: "3,500,000 VND",
            primary: null,
            menu: [],
        })
        expect(queue.rows[1]).toMatchObject({ title: "t2", description: "", proposal: "" })
    })

    it("names a payment by its transfer content when the payer is unknown", () => {
        expect(unmatchedQueueOf([{ ...PAID, payer: null }], 1).rows[0]?.title).toBe("CK HOA SEN")
    })

    it("has no count for an empty queue", () => {
        expect(unmatchedQueueOf([], 0)).toEqual({ count: null, more: null, rows: [] })
    })
})
