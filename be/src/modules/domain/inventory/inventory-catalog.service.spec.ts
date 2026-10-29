import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import {
    DELETE_RECIPE,
    SAVE_ITEM,
    SAVE_RECIPE,
    SAVE_SUPPLIER,
    SET_ITEM_ACTIVE,
} from "@tests/fixtures/builders/inventory-calls.builder"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"
const UUID_2 = "1c9d2a1f-4b5a-4c8f-8e4a-3d2a7b6e8fa1"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const movements = mock<InventoryMovementsService>()
    movements.totals.mockResolvedValue(new Map([["item-1", 4]]))
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryCatalogService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryCatalogService), office, members, movements }
}

const itemParams = {
    sku: "",
    name: "  Green tea  ",
    unit: "",
    units: "box=24",
    category: "Pantry",
    cost: "1.200",
    sell: "",
    reorderPoint: "5",
    reorderQty: "20",
    supplierId: UUID,
    aliases: "tea, green",
}

describe("InventoryCatalogService / saveItem", () => {
    it("creates an item with a derived upper-case code, the default unit and an opening movement", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, [{ inventory_save_item: "item-9" }]] })
        const { service, members, movements, office } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", { ...itemParams, openingQty: "12" })).resolves.toEqual({
            id: "item-9",
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            null,
            "GREEN-TEA",
            "Green tea",
            text("inventory.defaultUnit"),
            '[{"unit":"box","factor":24}]',
            "Pantry",
            1200,
            null,
            5,
            20,
            UUID,
            ["tea", "green"],
        ])
        expect(movements.apply).toHaveBeenCalledWith("ws-1", {
            itemId: "item-9",
            kind: "adjust",
            delta: 12,
            reason: text("inventory.openingStock"),
            by: "Lan",
        })
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "inventory.item_created",
            actor: "Lan",
            summary: text("inventory.itemCreatedSummary", { name: "Green tea", sku: "GREEN-TEA" }),
        })
    })

    it("keeps a typed code and unit, and records no movement without an opening quantity", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, [{ inventory_save_item: "item-9" }]] })
        const { service, movements } = await build(em)

        await service.saveItem("user-1", "ws-1", {
            ...itemParams,
            sku: "tea-1",
            unit: "kg",
            sell: "3.000",
            supplierId: "",
        })

        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, expect.arrayContaining(["TEA-1", "kg", 3000, null]))
        expect(movements.apply).not.toHaveBeenCalled()
    })

    it("updates an item and keeps its code when none is typed", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, [{ inventory_save_item: UUID }]] })
        const { service, office } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", { ...itemParams, id: UUID, openingQty: "5" })).resolves.toEqual(
            { id: UUID },
        )

        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, expect.arrayContaining([UUID, ""]))
        expect(office.logEvidence).not.toHaveBeenCalled()
    })

    it("refuses an empty name", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.saveItem("user-1", "ws-1", { ...itemParams, name: " " })).rejects.toMatchObject({
            code: InventoryErrorCode.ItemNameRequired,
        })
    })
})

describe("InventoryCatalogService / saveItem", () => {
    it("refuses a code another item already has", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, []] })
        em.query.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }))
        const { service } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", { ...itemParams, sku: "dup" })).rejects.toMatchObject({
            code: InventoryErrorCode.ItemSkuTaken,
            params: { sku: "DUP" },
        })
    })

    it("rethrows any other database failure", async () => {
        const failure = new Error("connection lost")
        const em = mockEntityManager({ query: [SAVE_ITEM, []] })
        em.query.mockRejectedValueOnce(failure)
        const { service } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", itemParams)).rejects.toBe(failure)
    })

    it("refuses when the item to update is missing", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, [{ inventory_save_item: null }]] })
        const { service } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", { ...itemParams, id: UUID })).rejects.toMatchObject({
            code: InventoryErrorCode.ItemNotFound,
        })
    })

    it("refuses when the database answers no row", async () => {
        const em = mockEntityManager({ query: [SAVE_ITEM, []] })
        const { service } = await build(em)

        await expect(service.saveItem("user-1", "ws-1", itemParams)).rejects.toMatchObject({
            code: InventoryErrorCode.ItemNotFound,
        })
    })
})

describe("InventoryCatalogService / setItemActive", () => {
    it("switches the item after proving the caller is a manager", async () => {
        const em = mockEntityManager({ query: [SET_ITEM_ACTIVE, []] })
        const { service, members } = await build(em)

        await service.setItemActive("user-1", "ws-1", { id: UUID, active: false })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(SET_ITEM_ACTIVE, ["ws-1", UUID, false])
    })
})

describe("InventoryCatalogService / saveSupplier", () => {
    const supplier = {
        name: " Mill Co ",
        contactName: "Huong",
        email: " Orders@Mill.VN ",
        phone: "",
        zalo: "",
        channel: "zalo",
        leadTime: "3",
        terms: "7 days",
        note: "",
    }
    it("creates a supplier with cleaned fields", async () => {
        const em = mockEntityManager({ query: [SAVE_SUPPLIER, [{ inventory_save_supplier: "sup-1" }]] })
        const { service } = await build(em)

        await expect(service.saveSupplier("user-1", "ws-1", supplier)).resolves.toEqual({ id: "sup-1" })

        expect(em.query).toHaveBeenCalledWith(SAVE_SUPPLIER, [
            "ws-1",
            null,
            "Mill Co",
            "Huong",
            "orders@mill.vn",
            null,
            null,
            "zalo",
            3,
            "7 days",
            "",
        ])
    })

    it("updates a supplier, defaults the channel to email and clamps the delivery time", async () => {
        const em = mockEntityManager({ query: [SAVE_SUPPLIER, [{ inventory_save_supplier: UUID }]] })
        const { service } = await build(em)

        await service.saveSupplier("user-1", "ws-1", {
            ...supplier,
            id: UUID,
            email: "",
            channel: "fax",
            leadTime: "99",
            phone: "0900",
            zalo: "z1",
        })

        expect(em.query).toHaveBeenCalledWith(SAVE_SUPPLIER, [
            "ws-1",
            UUID,
            "Mill Co",
            "Huong",
            null,
            "0900",
            "z1",
            "email",
            60,
            "7 days",
            "",
        ])
    })

    it("uses the default delivery time when none is typed", async () => {
        const em = mockEntityManager({ query: [SAVE_SUPPLIER, [{ inventory_save_supplier: "sup-1" }]] })
        const { service } = await build(em)

        await service.saveSupplier("user-1", "ws-1", { ...supplier, leadTime: "" })

        expect(em.query).toHaveBeenCalledWith(SAVE_SUPPLIER, expect.arrayContaining([2]))
    })
})

describe("InventoryCatalogService / saveSupplier", () => {
    const supplier = {
        name: " Mill Co ",
        contactName: "Huong",
        email: " Orders@Mill.VN ",
        phone: "",
        zalo: "",
        channel: "zalo",
        leadTime: "3",
        terms: "7 days",
        note: "",
    }
    it("refuses an empty name, a bad email and a missing supplier", async () => {
        const missing = mockEntityManager({ query: [SAVE_SUPPLIER, []] })
        const { service } = await build(missing)

        await expect(service.saveSupplier("user-1", "ws-1", { ...supplier, name: "" })).rejects.toMatchObject({
            code: InventoryErrorCode.SupplierNameRequired,
        })
        await expect(service.saveSupplier("user-1", "ws-1", { ...supplier, email: "nope" })).rejects.toMatchObject({
            code: InventoryErrorCode.SupplierEmailInvalid,
        })
        await expect(service.saveSupplier("user-1", "ws-1", { ...supplier, id: UUID })).rejects.toMatchObject({
            code: InventoryErrorCode.SupplierNotFound,
        })
    })
})

describe("InventoryCatalogService / saveRecipe", () => {
    it("saves a recipe with its usable ingredient lines", async () => {
        const em = mockEntityManager({ query: [SAVE_RECIPE, [{ inventory_save_recipe: "rec-1" }]] })
        const { service } = await build(em)

        await expect(
            service.saveRecipe("user-1", "ws-1", {
                id: UUID,
                name: "Milk coffee",
                aliases: "latte",
                lines: [
                    { itemId: UUID_2, qty: "1,5" },
                    { itemId: "bad", qty: "2" },
                    { itemId: UUID, qty: "0" },
                ],
            }),
        ).resolves.toEqual({ id: "rec-1" })

        expect(em.query).toHaveBeenCalledWith(SAVE_RECIPE, ["ws-1", UUID, "Milk coffee", ["latte"], [UUID_2], [1.5]])
    })

    it("refuses an empty name, no usable line and a missing recipe", async () => {
        const missing = mockEntityManager({ query: [SAVE_RECIPE, [{ inventory_save_recipe: null }]] })
        const { service } = await build(missing)
        const line = { itemId: UUID_2, qty: "1" }

        await expect(
            service.saveRecipe("user-1", "ws-1", { name: " ", aliases: "", lines: [line] }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.RecipeNameRequired })
        await expect(service.saveRecipe("user-1", "ws-1", { name: "A", aliases: "", lines: [] })).rejects.toMatchObject(
            { code: InventoryErrorCode.RecipeLinesRequired },
        )
        await expect(
            service.saveRecipe("user-1", "ws-1", { name: "A", aliases: "", lines: [line] }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.RecipeNotFound })
    })
})

describe("InventoryCatalogService / deleteRecipe", () => {
    it("deletes the recipe", async () => {
        const em = mockEntityManager({ query: [DELETE_RECIPE, []] })
        const { service } = await build(em)

        await service.deleteRecipe("user-1", "ws-1", { id: UUID })

        expect(em.query).toHaveBeenCalledWith(DELETE_RECIPE, ["ws-1", UUID])
    })
})
