import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER, callDbFunction } from "@modules/platform/database"
import { inventoryItemOf, inventoryRecipeOf, inventorySupplierOf } from "@tests/fixtures/builders/inventory.builder"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryImportService } from "./inventory-import.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { INVENTORY_TEMPLATES, inventoryStarterOf } from "./inventory.templates"
import { idColumn, savedId } from "./policies/saved-id.policy"
import { InventoryItemEntity, InventoryRecipeEntity, InventorySupplierEntity } from "./persistence/entities"
import { IMPORT_ITEM, SAVE_ITEM, SAVE_RECIPE, SAVE_SUPPLIER } from "@tests/fixtures/builders/inventory-calls.builder"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: { [K in keyof InventoryItemEntity]?: InventoryItemEntity[K] } = {}): InventoryItemEntity =>
    inventoryItemOf(overrides)

const supplierRow = (
    overrides: { [K in keyof InventorySupplierEntity]?: InventorySupplierEntity[K] } = {},
): InventorySupplierEntity => inventorySupplierOf(overrides)

const recipeRow = (
    overrides: { [K in keyof InventoryRecipeEntity]?: InventoryRecipeEntity[K] } = {},
): InventoryRecipeEntity => inventoryRecipeOf(overrides)

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
    const locations = mock<InventoryLocationsService>()
    const catalogue = mock<InventoryCatalogService>()
    catalogue.writeSupplier.mockImplementation((_workspaceId, fields) =>
        savedId(
            idColumn(
                callDbFunction<Record<string, string | null>>(entityManager, "public.inventory_save_supplier", [
                    fields.name,
                    ...Array<null>(10).fill(null),
                ]),
                "inventory_save_supplier",
            ),
            InventoryErrorCode.SupplierNotFound,
        ),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryImportService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: InventoryCatalogService, useValue: catalogue },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryImportService), office, movements, locations, catalogue }
}

const cafeStarter: Parameters<InventoryImportService["applyStarter"]>[2] = {
    name: "Cafe",
    suppliers: [
        { name: "Mill Co", channel: "email", leadTimeDays: 1 },
        {
            name: "Fresh Ltd",
            contactName: "Huong",
            email: "a@b.vn",
            phone: "1",
            zalo: "2",
            channel: "zalo",
            leadTimeDays: 1,
            paymentTerms: "7d",
        },
        { name: "Bare Ltd", channel: "phone", leadTimeDays: 3 },
    ],
    items: [
        {
            sku: "TEA",
            name: "Tea",
            unit: "kg",
            category: "x",
            costVnd: 1,
            reorderPoint: 1,
            reorderQty: 1,
            qty: 1,
        },
        {
            sku: "FLOUR",
            name: "Flour",
            unit: "kg",
            units: [{ unit: "bag", factor: 25 }],
            category: "Dry",
            costVnd: 10,
            sellPriceVnd: 12,
            reorderPoint: 2,
            reorderQty: 5,
            supplier: "Fresh Ltd",
            aliases: ["bot"],
            qty: 5,
        },
        {
            sku: "SALT",
            name: "Salt",
            unit: "kg",
            category: "Dry",
            costVnd: 2,
            reorderPoint: 1,
            reorderQty: 1,
            supplier: "Nobody",
            qty: 0,
        },
    ],
    recipes: [
        { name: "Old", lines: [] },
        {
            name: "Cake",
            aliases: ["gato"],
            lines: [
                { sku: "FLOUR", qty: 2 },
                { sku: "GHOST", qty: 1 },
            ],
        },
        { name: "Bread", lines: [] },
    ],
}

describe("InventoryImportService / importPasted", () => {
    it("refuses a table with no named row", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.importPasted("user-1", "ws-1", { raw: "  " })).rejects.toMatchObject({
            code: InventoryErrorCode.ImportEmpty,
        })
    })

    it("creates and updates items, creates a missing supplier, sets opening stock and queues the low-stock check", async () => {
        const em = mockEntityManager({
            find: [
                [
                    InventoryItemEntity,
                    [
                        itemRow({ id: "item-1", sku: "TEA", name: "Tea" }),
                        itemRow({ id: "item-2", sku: "SUGAR", name: "Sugar" }),
                    ],
                ],
                [InventorySupplierEntity, [supplierRow({ id: "sup-1", name: "Mill Co" })]],
            ],
            query: [
                [IMPORT_ITEM, [{ inventory_import_item: "item-1" }]],
                [IMPORT_ITEM, [{ inventory_import_item: "item-2" }]],
                [SAVE_SUPPLIER, [{ inventory_save_supplier: "sup-2" }]],
                [IMPORT_ITEM, [{ inventory_import_item: "item-3" }]],
                [IMPORT_ITEM, [{ inventory_import_item: "item-4" }]],
                [IMPORT_ITEM, [{ inventory_import_item: "item-5" }]],
            ],
        })
        const { service, movements, office } = await build(em)
        movements.totals.mockImplementation((_workspaceId, ids) =>
            Promise.resolve(new Map(ids?.filter((id) => id !== "item-3").map((id) => [id, id === "item-1" ? 4 : 8]))),
        )
        const raw = [
            "SKU,Name,Unit,Qty,Supplier",
            "TEA,Tea,kg,10,Mill Co",
            "OTHER,Sugar,kg,8,",
            "NEW,Flour,kg,3,Fresh Ltd",
            "NEW,Rice,kg,,",
            ",Salt,kg,,",
            ",,,,",
        ].join("\n")

        const result = await service.importPasted("user-1", "ws-1", { raw })

        expect(result).toEqual({ created: 3, updated: 2, stocked: 2, skipped: [",,,,"] })
        expect(em.query).toHaveBeenCalledWith(IMPORT_ITEM, expect.arrayContaining(["NEW-2"]))
        expect(em.query).toHaveBeenCalledWith(IMPORT_ITEM, expect.arrayContaining(["SALT"]))
        expect(movements.apply).toHaveBeenCalledTimes(2)
        expect(movements.apply).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ itemId: "item-1", delta: 6, refType: "import", by: "Lan" }),
        )
        expect(movements.apply).toHaveBeenCalledWith("ws-1", expect.objectContaining({ itemId: "item-3", delta: 3 }))
        expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", ["item-1", "item-3"])
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", expect.objectContaining({ kind: "inventory.import" }))
    })
})

describe("InventoryImportService / importPasted", () => {
    it("refuses when the database answers no id for an imported item or a new supplier", async () => {
        const noItem = mockEntityManager({
            find: [InventoryItemEntity, []],
            query: [[IMPORT_ITEM, [{ inventory_import_item: null }]]],
        })
        const first = await build(noItem)

        await expect(first.service.importPasted("user-1", "ws-1", { raw: "A1,Salt" })).rejects.toMatchObject({
            code: InventoryErrorCode.ItemNotFound,
        })

        const noSupplier = mockEntityManager({
            find: [
                [InventoryItemEntity, []],
                [InventorySupplierEntity, []],
            ],
            query: [[SAVE_SUPPLIER, []]],
        })
        const second = await build(noSupplier)

        await expect(
            second.service.importPasted("user-1", "ws-1", { raw: "SKU,Name,Supplier\nA1,Salt,Nobody" }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.SupplierNotFound })
    })
})

describe("InventoryImportService", () => {
    it("lists the starter sets a new shop can pick", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.listTemplates()).resolves.toBe(INVENTORY_TEMPLATES)
    })

    it("applies a named starter while preserving every existing supplier, item and recipe", async () => {
        const starter = inventoryStarterOf("cafe")
        const em = mockEntityManager({
            find: [
                [
                    InventorySupplierEntity,
                    starter.suppliers.map((supplier) => supplierRow({ id: supplier.name, name: supplier.name })),
                ],
                [
                    InventoryItemEntity,
                    starter.items.map((item) => itemRow({ id: item.sku, sku: item.sku, name: item.name })),
                ],
                [InventoryRecipeEntity, starter.recipes.map((recipe) => recipeRow({ name: recipe.name }))],
            ],
        })
        const { service, catalogue, movements, office } = await build(em)

        await expect(service.applyStarterKey("user-1", "ws-1", "cafe")).resolves.toEqual({
            items: 0,
            suppliers: 0,
            recipes: 0,
        })
        expect(catalogue.writeSupplier).not.toHaveBeenCalled()
        expect(movements.apply).not.toHaveBeenCalled()
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "inventory.template",
            actor: "Lan",
            summary: text("inventory.starterSummary", { name: starter.name, items: 0, suppliers: 0, recipes: 0 }),
        })
        expect(thrownBy(() => service.applyStarterKey("user-1", "ws-1", "missing"))).toEqual(
            objectLike({ code: InventoryErrorCode.StarterUnknown }),
        )
    })
})

describe("InventoryImportService", () => {
    it("stores a starter item without a supplier and records the exact import summary", async () => {
        const em = mockEntityManager({
            find: [
                [InventorySupplierEntity, []],
                [InventoryItemEntity, []],
                [InventoryRecipeEntity, []],
            ],
            query: [[SAVE_ITEM, [{ inventory_save_item: "item-1" }]]],
        })
        const { service, movements, office } = await build(em)

        await expect(
            service.applyStarter("user-1", "ws-1", {
                name: "Bare",
                suppliers: [],
                recipes: [],
                items: [
                    {
                        sku: "TEA",
                        name: "Tea",
                        unit: "kg",
                        category: "Pantry",
                        costVnd: 2,
                        reorderPoint: 0,
                        reorderQty: 0,
                        qty: 0,
                    },
                ],
            }),
        ).resolves.toEqual({ items: 1, suppliers: 0, recipes: 0 })
        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            null,
            "TEA",
            "Tea",
            "kg",
            "[]",
            "Pantry",
            2,
            null,
            0,
            0,
            null,
            [],
        ])
        expect(movements.apply).not.toHaveBeenCalled()
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "inventory.template",
            actor: "Lan",
            summary: text("inventory.starterSummary", { name: "Bare", items: 1, suppliers: 0, recipes: 0 }),
        })
    })
})

describe("InventoryImportService / applyStarter", () => {
    it("adds the missing suppliers, items with opening stock and recipes, and leaves what exists", async () => {
        const em = mockEntityManager({
            find: [
                [InventorySupplierEntity, [supplierRow({ id: "sup-1", name: "Mill Co" })]],
                [InventoryItemEntity, [itemRow({ id: "item-1", sku: "TEA", name: "Tea" })]],
                [InventoryRecipeEntity, [recipeRow({ name: "Old" })]],
            ],
            query: [
                [SAVE_SUPPLIER, [{ inventory_save_supplier: "sup-2" }]],
                [SAVE_SUPPLIER, [{ inventory_save_supplier: "sup-3" }]],
                [SAVE_ITEM, [{ inventory_save_item: "item-5" }]],
                [SAVE_ITEM, [{ inventory_save_item: "item-6" }]],
                [SAVE_RECIPE, []],
                [SAVE_RECIPE, []],
            ],
        })
        const { service, locations, movements, office } = await build(em)

        const result = await service.applyStarter("user-1", "ws-1", cafeStarter)

        expect(result).toEqual({ items: 2, suppliers: 2, recipes: 2 })
        expect(locations.defaultLocation).toHaveBeenCalledWith("ws-1")
        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            null,
            "FLOUR",
            "Flour",
            "kg",
            JSON.stringify([{ unit: "bag", factor: 25 }]),
            "Dry",
            10,
            12,
            2,
            5,
            "sup-2",
            ["bot"],
        ])
        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            null,
            "SALT",
            "Salt",
            "kg",
            "[]",
            "Dry",
            2,
            null,
            1,
            1,
            null,
            [],
        ])
        expect(em.query).toHaveBeenCalledWith(SAVE_RECIPE, ["ws-1", null, "Cake", ["gato"], ["item-5"], [2]])
        expect(em.query).toHaveBeenCalledWith(SAVE_RECIPE, ["ws-1", null, "Bread", [], [], []])
        expect(movements.apply).toHaveBeenCalledTimes(1)
        expect(movements.apply).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ itemId: "item-5", delta: 5, refType: "import" }),
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "inventory.template",
            actor: "Lan",
            summary: text("inventory.starterSummary", { name: "Cafe", items: 2, suppliers: 2, recipes: 2 }),
        })
    })
})

describe("InventoryImportService / applyStarter", () => {
    it("refuses when the database answers no id for a supplier or an item", async () => {
        const noSupplier = mockEntityManager({
            find: [InventorySupplierEntity, []],
            query: [[SAVE_SUPPLIER, [{ inventory_save_supplier: null }]]],
        })
        const first = await build(noSupplier)

        await expect(
            first.service.applyStarter("user-1", "ws-1", {
                name: "Cafe",
                suppliers: [{ name: "A", channel: "email", leadTimeDays: 1 }],
                items: [],
                recipes: [],
            }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.SupplierNotFound })

        const noItem = mockEntityManager({
            find: [
                [InventorySupplierEntity, []],
                [InventoryItemEntity, []],
            ],
            query: [[SAVE_ITEM, []]],
        })
        const second = await build(noItem)
        const item = {
            sku: "A",
            name: "A",
            unit: "kg",
            category: "",
            costVnd: 0,
            reorderPoint: 0,
            reorderQty: 0,
            qty: 0,
        }

        await expect(
            second.service.applyStarter("user-1", "ws-1", {
                name: "Cafe",
                suppliers: [],
                items: [item],
                recipes: [],
            }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.ItemNotFound })
    })
})
