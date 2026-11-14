import { salesDecisionQueueOf } from "./decisions"

const WITH_CUSTOMER = { id: "o1", orderNo: "DH-1", items: "2 x tea", amountVnd: 6000000, customer: "Lan" }
const BARE = { id: "o2", orderNo: "DH-2", items: "", amountVnd: null, customer: null }

describe("salesDecisionQueueOf", () => {
    it("draws each waiting order as a decision with approve and reject", () => {
        const queue = salesDecisionQueueOf([WITH_CUSTOMER, BARE], 3)
        expect(queue.count).toBe("3")
        expect(queue.rows[0]).toMatchObject({
            id: "o1",
            title: "DH-1 \u00b7 Lan",
            amount: "6.000.000\u00a0\u20ab",
            primary: { id: "approve" },
            menu: [{ id: "reject", isDanger: true }],
        })
        expect(queue.rows[1]?.amount).toBeNull()
    })

    it("has no count for an empty queue", () => {
        expect(salesDecisionQueueOf([], 0)).toEqual({ count: null, more: null, rows: [] })
    })
})
