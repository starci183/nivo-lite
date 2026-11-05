import { ORDER_WAITING } from "./sales.data"
import { SALES_FIXTURES, customerOf } from "./sales.fixtures"

describe("the sample data of the Sales fixtures", () => {
    it("names the customer of an order, none for an order with no customer or whose customer is gone", () => {
        expect(customerOf(ORDER_WAITING)).toBe("Pham Quoc Dung")
        expect(customerOf({ ...ORDER_WAITING, leadId: "lead-9" })).toBeNull()
        expect(customerOf({ ...ORDER_WAITING, leadId: null })).toBeNull()
    })

    it("counts the sample leads per stage and the sample orders per status", () => {
        expect(SALES_FIXTURES.reads["sales.lead-counts"]?.ready).toEqual({
            counts: { new: 2, qualified: 1, proposal: 1, won: 1, lost: 0 },
            total: 5,
        })
        expect(SALES_FIXTURES.reads["sales.order-counts"]?.ready).toMatchObject({
            counts: { draft: 2, confirmed: 1, invoiced: 0, paid: 2, cancelled: 1, failed_system: 0 },
            total: 6,
        })
        expect(SALES_FIXTURES.reads["sales.order-counts"]?.empty).toMatchObject({ total: 0 })
    })

    it("lists the one order at the owner threshold as the waiting order", () => {
        expect(SALES_FIXTURES.reads["sales.orders-waiting"]?.ready).toEqual({
            count: "1",
            rows: [
                {
                    id: "order-1",
                    title: "DH-20261104-0001 · Pham Quoc Dung",
                    description: "10 x gift set · 6,000,000 VND",
                    href: "?tab=orders&order=order-1",
                },
            ],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })
})
