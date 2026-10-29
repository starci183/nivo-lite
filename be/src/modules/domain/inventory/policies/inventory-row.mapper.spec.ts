import {
    ITEM_LIMIT,
    OPEN_PO_STATUSES,
    itemRowOf,
    levelInputOf,
    movementInputOf,
    poLineInputOf,
    recipeInputOf,
    recipeLineInputOf,
    supplierInputOf,
} from "./inventory-row.mapper"

const as = <T>(value: object): T => value as unknown as T
const AT = new Date("2026-03-02T09:00:00.000Z")

describe("inventory row mapper", () => {
    it("exposes the read limit and the open purchase-order states", () => {
        expect(ITEM_LIMIT).toBe(2000)
        expect(OPEN_PO_STATUSES).toEqual(["draft", "waiting_approval", "sent", "partially_received"])
    })

    it("maps an item", () => {
        expect(
            itemRowOf(
                as({
                    id: "i1",
                    sku: "SKU1",
                    name: "Flour",
                    unit: "kg",
                    units: [],
                    category: "dry",
                    costVnd: 100,
                    sellPriceVnd: 150,
                    reorderPoint: 5,
                    reorderQty: 20,
                    supplierId: "s1",
                    aliases: ["bot"],
                    active: true,
                }),
            ),
        ).toEqual({
            id: "i1",
            sku: "SKU1",
            name: "Flour",
            unit: "kg",
            units: [],
            category: "dry",
            cost_vnd: 100,
            sell_price_vnd: 150,
            reorder_point: 5,
            reorder_qty: 20,
            supplier_id: "s1",
            aliases: ["bot"],
            active: true,
        })
    })

    it("maps a supplier", () => {
        expect(
            supplierInputOf(
                as({
                    id: "s1",
                    name: "Mill",
                    contactName: "An",
                    email: "an@mill.vn",
                    phone: "090",
                    zalo: "091",
                    channel: "zalo",
                    leadTimeDays: 3,
                    paymentTerms: "net7",
                    note: "n",
                }),
            ),
        ).toEqual({
            id: "s1",
            name: "Mill",
            contact_name: "An",
            email: "an@mill.vn",
            phone: "090",
            zalo: "091",
            channel: "zalo",
            lead_time_days: 3,
            payment_terms: "net7",
            note: "n",
        })
    })

    it("maps a stock level", () => {
        expect(levelInputOf(as({ itemId: "i1", locationId: "l1", qty: 4 }))).toEqual({
            item_id: "i1",
            location_id: "l1",
            qty: 4,
        })
    })

    it("maps a recipe and its line", () => {
        expect(recipeInputOf(as({ id: "r1", name: "Bread", aliases: ["banh"] }))).toEqual({
            id: "r1",
            name: "Bread",
            aliases: ["banh"],
        })
        expect(recipeLineInputOf(as({ recipeId: "r1", itemId: "i1", qty: 2 }))).toEqual({
            recipe_id: "r1",
            item_id: "i1",
            qty: 2,
        })
    })

    it("maps a purchase order line", () => {
        expect(
            poLineInputOf(
                as({ id: "pl1", poId: "po1", itemId: "i1", qtyOrdered: 10, qtyReceived: 4, unitCostVnd: 100 }),
            ),
        ).toEqual({
            id: "pl1",
            po_id: "po1",
            item_id: "i1",
            qty_ordered: 10,
            qty_received: 4,
            unit_cost_vnd: 100,
        })
    })

    it("maps a movement", () => {
        expect(
            movementInputOf(
                as({
                    id: "m1",
                    itemId: "i1",
                    kind: "receive",
                    qty: 3,
                    qtyAfter: 7,
                    reason: "delivery",
                    refLabel: "PO-1",
                    byName: "An",
                    evidence: null,
                    createdAt: AT,
                }),
            ),
        ).toEqual({
            id: "m1",
            item_id: "i1",
            kind: "receive",
            qty: 3,
            qty_after: 7,
            reason: "delivery",
            ref_label: "PO-1",
            by_name: "An",
            evidence: null,
            created_at: AT,
        })
    })
})
