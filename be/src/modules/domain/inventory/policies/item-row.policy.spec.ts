import { toInventoryItem } from "./item-row.policy"
import type { ItemRowColumns } from "./item-row.policy"

const rowOf = (overrides: Partial<ItemRowColumns>): ItemRowColumns => ({
    id: "item-1",
    sku: "SKU1",
    name: "Sugar",
    unit: "kg",
    units: [],
    category: "Pantry",
    cost_vnd: "1200.50",
    sell_price_vnd: null,
    reorder_point: "5.000",
    reorder_qty: "20",
    supplier_id: null,
    aliases: ["sweet"],
    active: true,
    ...overrides,
})

describe("toInventoryItem", () => {
    it("turns the numeric columns into numbers", () => {
        expect(toInventoryItem(rowOf({ sell_price_vnd: "1500" }))).toEqual({
            id: "item-1",
            sku: "SKU1",
            name: "Sugar",
            unit: "kg",
            units: [],
            category: "Pantry",
            costVnd: 1200.5,
            sellPriceVnd: 1500,
            reorderPoint: 5,
            reorderQty: 20,
            supplierId: null,
            aliases: ["sweet"],
            active: true,
        })
    })

    it("keeps an absent selling price absent", () => {
        expect(toInventoryItem(rowOf({})).sellPriceVnd).toBeNull()
    })

    it("keeps the usable unit conversions and drops the broken ones", () => {
        const units = [
            { unit: "box", factor: "24" },
            { unit: "", factor: 5 },
            { unit: "bag", factor: 0 },
            "junk",
            { unit: "pack" },
        ]

        expect(toInventoryItem(rowOf({ units })).units).toEqual([{ unit: "box", factor: 24 }])
    })

    it("reads a units column that is not a list as no conversions", () => {
        expect(toInventoryItem(rowOf({ units: { unit: "box" } })).units).toEqual([])
    })
})
