import { ORDER_WAITING } from "./sales.data"
import { SALES_FIXTURES, customerOf } from "./sales.fixtures"

describe("the sample data of the Sales fixtures", () => {
    it("names the customer of an order, none for an order with no customer or whose customer is gone", () => {
        expect(customerOf(ORDER_WAITING)).toBe("Ph\u1ea1m Qu\u1ed1c D\u0169ng")
        expect(customerOf({ ...ORDER_WAITING, contactId: "contact-lead-9" })).toBeNull()
        expect(customerOf({ ...ORDER_WAITING, contactId: null })).toBeNull()
    })

    it("counts the sample leads per stage and the sample orders per status", () => {
        expect(SALES_FIXTURES.reads["blocks-core.sales.api.lead.counts"]?.ready).toEqual({
            counts: { new: 2, qualified: 1, proposal: 1, won: 1, lost: 0 },
            total: 5,
        })
        expect(SALES_FIXTURES.reads["blocks-core.sales.api.order.counts"]?.ready).toMatchObject({
            counts: { draft: 2, confirmed: 1, invoiced: 0, paid: 2, cancelled: 1, failed_system: 1 },
            total: 7,
        })
        expect(SALES_FIXTURES.reads["blocks-core.sales.api.order.counts"]?.empty).toMatchObject({ total: 0 })
    })

    it("lists the one order at the owner threshold as the waiting order", () => {
        expect(SALES_FIXTURES.reads["blocks-core.sales.api.order.waiting"]?.ready).toEqual({
            count: "1",
            rows: [
                {
                    id: "order-1",
                    title: "DH-20261104-0001 \u00b7 Ph\u1ea1m Qu\u1ed1c D\u0169ng",
                    description: "10 x h\u1ed9p qu\u00e0 \u00b7 6.000.000\u00a0\u20ab",
                    href: "?tab=orders&order=order-1",
                },
            ],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })
})
