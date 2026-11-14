import { waitingViewOf } from "./waiting"
import type { WaitingOrder } from "./waiting"

const hrefOf = (orderId: string): string => `?order=${orderId}`

const orders: ReadonlyArray<WaitingOrder> = [
    { id: "o1", orderNo: "DH-1", items: "10 x tea", amountVnd: 6_000_000, customer: "Lan" },
    { id: "o2", orderNo: "DH-2", items: "", amountVnd: null, customer: null },
    { id: "o3", orderNo: "DH-3", items: "1 x set", amountVnd: 5_000_000, customer: "Binh" },
]

describe("waitingViewOf", () => {
    it("lists the orders with the customer, the items and the amount", () => {
        expect(waitingViewOf(orders, 3, 5, hrefOf)).toEqual({
            count: "3",
            rows: [
                { id: "o1", title: "DH-1 \u00b7 Lan", description: "10 x tea \u00b7 6.000.000\u00a0\u20ab", href: "?order=o1" },
                { id: "o2", title: "DH-2", description: "", href: "?order=o2" },
                { id: "o3", title: "DH-3 \u00b7 Binh", description: "1 x set \u00b7 5.000.000\u00a0\u20ab", href: "?order=o3" },
            ],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })

    it("cuts the rows to the number shown and counts the rest", () => {
        const view = waitingViewOf(orders.slice(0, 2), 7, 1, hrefOf)
        expect(view.rows.map((row) => row.id)).toEqual(["o1"])
        expect(view.count).toBe("7")
        expect(view.more).toBe("+6")
    })

    it("has no count while nothing waits", () => {
        expect(waitingViewOf([], 0, 5, hrefOf)).toEqual({
            count: null,
            rows: [],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })
})
