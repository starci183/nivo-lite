import { attentionRowsOf, salesDecisionQueueOf } from "./decisions"

const WITH_CUSTOMER = { id: "o1", orderNo: "DH-1", items: "2 x tea", amountVnd: 6000000, customer: "Lan" }
const BARE = { id: "o2", orderNo: "DH-2", items: "", amountVnd: null, customer: null }

describe("attentionRowsOf", () => {
    it("names the order, its customer, its items and its amount, and why it needs a look", () => {
        expect(attentionRowsOf([WITH_CUSTOMER, BARE])).toEqual([
            { id: "o1", title: "DH-1 · Lan", description: "2 x tea · 6,000,000 VND", reason: "owner" },
            { id: "o2", title: "DH-2", description: "", reason: "owner" },
        ])
    })
})

describe("salesDecisionQueueOf", () => {
    it("draws each waiting order as a decision with approve and reject", () => {
        const queue = salesDecisionQueueOf([WITH_CUSTOMER, BARE], 3)
        expect(queue.count).toBe("3")
        expect(queue.rows[0]).toMatchObject({
            id: "o1",
            title: "DH-1 · Lan",
            amount: "6,000,000 VND",
            primary: { id: "approve" },
            menu: [{ id: "reject", isDanger: true }],
        })
        expect(queue.rows[1]?.amount).toBeNull()
    })

    it("has no count for an empty queue", () => {
        expect(salesDecisionQueueOf([], 0)).toEqual({ count: null, more: null, rows: [] })
    })
})
