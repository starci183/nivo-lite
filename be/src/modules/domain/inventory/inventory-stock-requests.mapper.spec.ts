import { toAdjustInventoryStockRequest, toAdjustStockType } from "./inventory-stock-requests.mapper"

describe("inventory stock requests", () => {
    it("keeps the given location, change and count of an adjustment", () => {
        expect(
            toAdjustInventoryStockRequest("ws-1", {
                itemId: "item-1",
                reason: "count",
                locationId: "loc-1",
                delta: -2,
                counted: 8,
            }),
        ).toEqual({
            workspaceId: "ws-1",
            itemId: "item-1",
            reason: "count",
            locationId: "loc-1",
            delta: -2,
            counted: 8,
        })
    })

    it("drops an absent or null location, change and count", () => {
        const expected = { workspaceId: "ws-1", itemId: "item-1", reason: "waste" }

        expect(
            toAdjustInventoryStockRequest("ws-1", {
                itemId: "item-1",
                reason: "waste",
                locationId: null,
                delta: null,
                counted: null,
            }),
        ).toEqual(expected)
        expect(toAdjustInventoryStockRequest("ws-1", { itemId: "item-1", reason: "waste" })).toEqual(expected)
    })

    it("answers an applied adjustment with its figures", () => {
        expect(toAdjustStockType({ state: "applied", before: 10, after: 8, workItemId: "w-1" })).toEqual({
            state: "applied",
            before: 10,
            after: 8,
            workItemId: "w-1",
        })
    })

    it("writes every absent figure as null", () => {
        expect(toAdjustStockType({ state: "waiting" })).toEqual({
            state: "waiting",
            before: null,
            after: null,
            workItemId: null,
        })
    })
})
