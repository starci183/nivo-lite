import { Test } from "@nestjs/testing"
import {
    inventoryItemOf,
    inventoryMovementOf,
    inventoryPoLineOf,
    inventoryRecipeLineOf,
    inventoryRecipeOf,
    inventoryStockLevelOf,
    inventorySupplierOf,
} from "@tests/fixtures/builders/inventory.builder"
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

const SUBJECT = Symbol("inventory-row.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    itemRowOf,
                    levelInputOf,
                    movementInputOf,
                    poLineInputOf,
                    recipeInputOf,
                    recipeLineInputOf,
                    supplierInputOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./inventory-row.mapper")>(SUBJECT)
}

describe("inventory row mapper limits", () => {
    it("exposes the read limit and the open purchase-order states", () => {
        expect(ITEM_LIMIT).toBe(2000)
        expect(OPEN_PO_STATUSES).toEqual(["draft", "waiting_approval", "sent", "partially_received"])
    })
})

describe("inventory row mapper catalogue rows", () => {
    it("maps an item", async () => {
        const subject = await buildSubject()

        expect(
            subject.itemRowOf(inventoryItemOf({ id: "i1", sku: "SKU1", supplierId: "s1", aliases: ["bot"] })),
        ).toEqual({
            id: "i1",
            sku: "SKU1",
            name: "Tea",
            unit: "kg",
            units: [],
            category: "",
            cost_vnd: "1000",
            sell_price_vnd: null,
            reorder_point: "0",
            reorder_qty: "0",
            supplier_id: "s1",
            aliases: ["bot"],
            active: true,
        })
    })

    it("maps a supplier", async () => {
        const subject = await buildSubject()

        expect(subject.supplierInputOf(inventorySupplierOf({ id: "s1", email: "an@mill.vn", phone: "090" }))).toEqual({
            id: "s1",
            name: "Mill Co",
            contact_name: "",
            email: "an@mill.vn",
            phone: "090",
            zalo: null,
            channel: "email",
            lead_time_days: 2,
            payment_terms: "",
            note: "",
        })
    })

    it("maps a recipe and its line", async () => {
        const subject = await buildSubject()

        expect(subject.recipeInputOf(inventoryRecipeOf({ id: "r1", aliases: ["banh"] }))).toEqual({
            id: "r1",
            name: "Milk coffee",
            aliases: ["banh"],
        })
        expect(subject.recipeLineInputOf(inventoryRecipeLineOf({ recipeId: "r1", qty: "2" }))).toEqual({
            recipe_id: "r1",
            item_id: "item-1",
            qty: "2",
        })
    })
})

describe("inventory row mapper stock rows", () => {
    it("maps a stock level", async () => {
        const subject = await buildSubject()

        expect(subject.levelInputOf(inventoryStockLevelOf({ qty: "4" }))).toEqual({
            item_id: "item-1",
            location_id: "loc-1",
            qty: "4",
        })
    })

    it("maps a purchase order line", async () => {
        const subject = await buildSubject()

        expect(subject.poLineInputOf(inventoryPoLineOf({ qtyOrdered: "10", qtyReceived: "4" }))).toEqual({
            id: "line-1",
            po_id: "po-1",
            item_id: "item-1",
            qty_ordered: "10",
            qty_received: "4",
            unit_cost_vnd: "0",
        })
    })

    it("maps a movement", async () => {
        const subject = await buildSubject()
        const movement = inventoryMovementOf({ kind: "in", qty: "3", qtyAfter: "7", refLabel: "PO-1", byName: "An" })

        expect(subject.movementInputOf(movement)).toEqual({
            id: "mov-1",
            item_id: "item-1",
            kind: "in",
            qty: "3",
            qty_after: "7",
            reason: "",
            ref_label: "PO-1",
            by_name: "An",
            evidence: null,
            created_at: movement.createdAt,
        })
    })
})
