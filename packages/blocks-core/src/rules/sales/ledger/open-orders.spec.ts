import { matchOf, openOrdersOf, openOrdersView, rankedOrders } from "./open-orders"
import type { OpenOrderRow } from "./open-orders"

const ORDERS = openOrdersOf([
    { id: "o1", orderNo: "DH-1", amountVnd: 5_000_000, customer: "Anh Khoa" },
    { id: "o2", orderNo: "DH-2", amountVnd: 310_000, customer: null },
    { id: "o3", orderNo: "DH-3", amountVnd: 300_000, customer: "Chi Lan" },
    { id: "o4", orderNo: "DH-4", amountVnd: null, customer: null },
]).rows

describe("openOrdersOf", () => {
    it("titles an order by its number and its customer, and writes the amount as words", () => {
        expect(ORDERS[0]).toMatchObject({ id: "o1", title: "DH-1 \u00b7 Anh Khoa", amountVnd: 5_000_000 })
        expect(ORDERS[0]?.amount).toContain("5.000.000")
        expect(ORDERS[1]).toMatchObject({ title: "DH-2" })
    })

    it("writes no amount for an order that is not priced yet", () => {
        expect(ORDERS[3]).toMatchObject({ amountVnd: null, amount: "" })
    })

    it("is a view the picker reads", () => {
        expect(openOrdersView.safeParse({ rows: ORDERS }).success).toBe(true)
        expect(openOrdersView.safeParse({ rows: [{ id: "" }] }).success).toBe(false)
    })
})

describe("matchOf", () => {
    const row = (amountVnd: number | null): OpenOrderRow => ({ id: "x", title: "t", amountVnd, amount: "" })

    it("is exact for the same amount, near within a tenth, and other beyond", () => {
        expect(matchOf(row(300_000), 300_000)).toBe("exact")
        expect(matchOf(row(310_000), 300_000)).toBe("near")
        expect(matchOf(row(330_000), 300_000)).toBe("near")
        expect(matchOf(row(331_000), 300_000)).toBe("other")
        expect(matchOf(row(270_000), 300_000)).toBe("near")
        expect(matchOf(row(269_000), 300_000)).toBe("other")
    })

    it("never calls an order that is not priced near", () => {
        expect(matchOf(row(null), 300_000)).toBe("other")
    })
})

describe("rankedOrders", () => {
    it("puts the same amount first, then the near ones, then the rest", () => {
        expect(rankedOrders(ORDERS, 300_000, "").map((order) => [order.id, order.match])).toEqual([
            ["o3", "exact"],
            ["o2", "near"],
            ["o1", "other"],
            ["o4", "other"],
        ])
    })

    it("keeps only the orders whose title holds the query, whatever its case or spaces", () => {
        expect(rankedOrders(ORDERS, 300_000, "  khoa ").map((order) => order.id)).toEqual(["o1"])
        expect(rankedOrders(ORDERS, 300_000, "zzz")).toEqual([])
    })
})
