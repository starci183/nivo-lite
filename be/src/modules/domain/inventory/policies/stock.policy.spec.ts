import { isSmallAdjustment, stockStatus, suggestOrderQty } from "./stock.policy"

describe("stockStatus", () => {
    it("is out when nothing is left", () => {
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, 0)).toBe("out")
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, -2)).toBe("out")
    })

    it("is low at or below the reorder point", () => {
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, 5)).toBe("low")
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, 3)).toBe("low")
    })

    it("is ok when there is no reorder point to compare with", () => {
        expect(stockStatus({ reorderPoint: 0, reorderQty: 0 }, 1000)).toBe("ok")
    })

    it("is over far above the point plus twice the usual order", () => {
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, 26)).toBe("over")
        expect(stockStatus({ reorderPoint: 5, reorderQty: 10 }, 25)).toBe("ok")
    })

    it("falls back to the reorder point for the step when there is no usual order", () => {
        expect(stockStatus({ reorderPoint: 5, reorderQty: 0 }, 16)).toBe("over")
        expect(stockStatus({ reorderPoint: 5, reorderQty: 0 }, 15)).toBe("ok")
    })
})

describe("suggestOrderQty", () => {
    it("is the usual order quantity when there is one", () => {
        expect(suggestOrderQty({ reorderPoint: 5, reorderQty: 12 }, 1)).toBe(12)
    })

    it("reaches twice the reorder point otherwise", () => {
        expect(suggestOrderQty({ reorderPoint: 5, reorderQty: 0 }, 2)).toBe(8)
        expect(suggestOrderQty({ reorderPoint: 5, reorderQty: 0 }, -3)).toBe(10)
    })

    it("is never less than one", () => {
        expect(suggestOrderQty({ reorderPoint: 1, reorderQty: 0 }, 5)).toBe(1)
    })
})

describe("isSmallAdjustment", () => {
    it("judges by value when the item has a cost", () => {
        expect(isSmallAdjustment(-10, 20_000)).toBe(true)
        expect(isSmallAdjustment(11, 20_000)).toBe(false)
    })

    it("judges by units when the item has no cost", () => {
        expect(isSmallAdjustment(5, 0)).toBe(true)
        expect(isSmallAdjustment(-6, 0)).toBe(false)
    })
})
