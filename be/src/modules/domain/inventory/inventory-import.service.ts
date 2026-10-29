import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { ImportRow } from "./inventory.contracts"
import type {
    ApplyStarterOutput,
    ApplyStarterParams,
    ImportPasteOutput,
    ImportPasteParams,
} from "./inventory-operations.contracts"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import type { InventoryTemplateInfo } from "./inventory-workbench.contracts"
import { INVENTORY_TEMPLATES, inventoryStarterOf } from "./inventory.templates"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { parseItemTable, skuFromName } from "./policies/item-table.policy"
import { channelOf } from "./policies/supplier-channel.policy"
import { idColumn, savedId } from "./policies/saved-id.policy"
import { InventoryItemEntity, InventoryRecipeEntity, InventorySupplierEntity } from "./persistence/entities"

/** The delivery time assumed when none is typed, in days. */
const LEAD_TIME_DEFAULT_DAYS = 2

/** The most items one import matches against. */
const ITEM_REF_LIMIT = 5000

/** The most suppliers one import matches against. */
const SUPPLIER_LIMIT = 1000

/** The most recipes one starter compares with. */
const RECIPE_LIMIT = 1000

@Injectable()
/** The bulk loads of the catalogue: a pasted item table and a starter set of suppliers, items and recipes. */
export class InventoryImportService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly movements: InventoryMovementsService,
        private readonly locations: InventoryLocationsService,
        private readonly catalogue: InventoryCatalogService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Imports items from a pasted table; an opening quantity becomes an adjust movement at the default location. */
    async importPasted(userId: string, workspaceId: string, request: ImportPasteParams): Promise<ImportPasteOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const parsed = parseItemTable(request.raw, this.text("inventory.defaultUnit", {}))
        const { rows, skipped } = parsed
        if (rows.length === 0) throw new InventoryError({ code: InventoryErrorCode.ImportEmpty })
        const { bySku, byName } = await this.knownItems(workspaceId)
        const used = new Set(bySku.keys())
        const suppliers = new Map<string, string>()
        const touched: Array<string> = []
        let created = 0
        let updated = 0
        await eachInOrder(rows, async (row: ImportRow) => {
            const sku = (row.sku || skuFromName(row.name)).toUpperCase()
            const knownId = bySku.get(sku.toLowerCase()) ?? byName.get(row.name.trim().toLowerCase()) ?? null
            let finalSku = sku
            let suffix = 2
            while (knownId === null && used.has(finalSku.toLowerCase())) {
                finalSku = `${sku}-${suffix}`
                suffix += 1
            }
            used.add(finalSku.toLowerCase())
            const supplierId =
                row.supplier === "" ? null : await this.supplierByName(workspaceId, row.supplier, suppliers)
            const itemId = await savedId(
                idColumn(
                    callDbFunction(this.entityManager, "public.inventory_import_item", [
                        workspaceId,
                        knownId,
                        finalSku,
                        row.name,
                        row.unit,
                        row.category,
                        row.costVnd,
                        row.sellPriceVnd,
                        row.reorderPoint,
                        row.reorderQty,
                        supplierId,
                    ]),
                    "inventory_import_item",
                ),
                InventoryErrorCode.ItemNotFound,
            )
            if (knownId === null) created += 1
            else updated += 1
            if (row.qty !== null && (await this.openingFor(workspaceId, actor, itemId, row.qty))) touched.push(itemId)
        })
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.import",
            actor,
            summary: this.text("inventory.importSummary", { created, updated, stocked: touched.length }),
        })
        await this.movements.replenishLater(workspaceId, touched)
        return { created, updated, stocked: touched.length, skipped }
    }

    private itemRefs(workspaceId: string): Promise<Array<Pick<InventoryItemEntity, "id" | "sku" | "name">>> {
        return this.entityManager.find(InventoryItemEntity, {
            select: { id: true, sku: true, name: true },
            where: { workspaceId },
            take: ITEM_REF_LIMIT,
        })
    }

    private supplierNames(workspaceId: string): Promise<Array<Pick<InventorySupplierEntity, "id" | "name">>> {
        return this.entityManager.find(InventorySupplierEntity, {
            select: { id: true, name: true },
            where: { workspaceId },
            take: SUPPLIER_LIMIT,
        })
    }

    private async knownItems(
        workspaceId: string,
    ): Promise<{ bySku: Map<string, string>; byName: Map<string, string> }> {
        const existing = await this.itemRefs(workspaceId)
        return {
            bySku: new Map(existing.map((row) => [row.sku.toLowerCase(), row.id])),
            byName: new Map(existing.map((row) => [row.name.trim().toLowerCase(), row.id])),
        }
    }

    private async openingFor(workspaceId: string, actor: string, itemId: string, qty: number): Promise<boolean> {
        const current = (await this.movements.totals(workspaceId, [itemId])).get(itemId) ?? 0
        if (qty === current) return false
        await this.movements.apply(workspaceId, {
            itemId,
            kind: "adjust",
            delta: qty - current,
            reason: this.text("inventory.importOpeningReason", {}),
            refType: "import",
            by: actor,
            evidence: this.text("inventory.importEvidence", {}),
        })
        return true
    }

    private async supplierByName(workspaceId: string, name: string, cache: Map<string, string>): Promise<string> {
        if (cache.size === 0) {
            const known = await this.supplierNames(workspaceId)
            for (const supplier of known) cache.set(supplier.name.trim().toLowerCase(), supplier.id)
        }
        const key = name.trim().toLowerCase()
        const cached = cache.get(key)
        if (cached !== undefined) return cached
        const id = await this.catalogue.writeSupplier(workspaceId, {
            id: null,
            name: name.trim(),
            contact: "",
            email: null,
            phone: null,
            zalo: null,
            channel: "email",
            leadTime: LEAD_TIME_DEFAULT_DAYS,
            terms: "",
            note: "",
        })
        cache.set(key, id)
        return id
    }

    /** The starter sets a new shop can pick. */
    listTemplates(): Promise<ReadonlyArray<InventoryTemplateInfo>> {
        return Promise.resolve(INVENTORY_TEMPLATES)
    }

    /** Loads the starter set a key names; an unknown key is invalid. */
    applyStarterKey(userId: string, workspaceId: string, key: string): Promise<ApplyStarterOutput> {
        return this.applyStarter(userId, workspaceId, inventoryStarterOf(key))
    }

    /**
     * Loads a starter set: suppliers, items (with opening stock) and recipes; items and recipes that already exist are
     * left as they are.
     */
    async applyStarter(userId: string, workspaceId: string, request: ApplyStarterParams): Promise<ApplyStarterOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.locations.defaultLocation(workspaceId)
        const { supplierIds, suppliers } = await this.loadStarterSuppliers(workspaceId, request)
        const itemIds = new Map((await this.itemRefs(workspaceId)).map((row) => [row.sku, row.id]))
        let items = 0
        await eachInOrder(
            request.items.filter((item) => !itemIds.has(item.sku)),
            async (item) => {
                const supplierId =
                    item.supplier === undefined ? null : (supplierIds.get(item.supplier.toLowerCase()) ?? null)
                const id = await savedId(
                    idColumn(
                        callDbFunction(this.entityManager, "public.inventory_save_item", [
                            workspaceId,
                            null,
                            item.sku,
                            item.name,
                            item.unit,
                            JSON.stringify(item.units ?? []),
                            item.category,
                            item.costVnd,
                            item.sellPriceVnd ?? null,
                            item.reorderPoint,
                            item.reorderQty,
                            supplierId,
                            item.aliases ?? [],
                        ]),
                        "inventory_save_item",
                    ),
                    InventoryErrorCode.ItemNotFound,
                )
                itemIds.set(item.sku, id)
                items += 1
                if (item.qty > 0) {
                    await this.movements.apply(workspaceId, {
                        itemId: id,
                        kind: "adjust",
                        delta: item.qty,
                        reason: this.text("inventory.starterOpeningReason", {}),
                        refType: "import",
                        by: actor,
                        evidence: this.text("inventory.starterEvidence", { name: request.name }),
                    })
                }
            },
        )
        const recipes = await this.saveStarterRecipes(workspaceId, request, itemIds)
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.template",
            actor,
            summary: this.text("inventory.starterSummary", { name: request.name, items, suppliers, recipes }),
        })
        return { items, suppliers, recipes }
    }

    private async saveStarterRecipes(
        workspaceId: string,
        request: ApplyStarterParams,
        itemIds: ReadonlyMap<string, string>,
    ): Promise<number> {
        const recipeNames = new Set(
            (
                await this.entityManager.find(InventoryRecipeEntity, {
                    select: { name: true },
                    where: { workspaceId },
                    take: RECIPE_LIMIT,
                })
            ).map((row) => row.name.toLowerCase()),
        )
        let recipes = 0
        await eachInOrder(
            request.recipes.filter((recipe) => !recipeNames.has(recipe.name.toLowerCase())),
            async (recipe) => {
                const lines = recipe.lines.flatMap((line) => {
                    const itemId = itemIds.get(line.sku)
                    return itemId === undefined ? [] : [{ itemId, qty: line.qty }]
                })
                await callDbFunction(this.entityManager, "public.inventory_save_recipe", [
                    workspaceId,
                    null,
                    recipe.name,
                    recipe.aliases ?? [],
                    lines.map((line) => line.itemId),
                    lines.map((line) => line.qty),
                ])
                recipes += 1
            },
        )
        return recipes
    }

    private async loadStarterSuppliers(
        workspaceId: string,
        request: ApplyStarterParams,
    ): Promise<{ supplierIds: Map<string, string>; suppliers: number }> {
        const supplierIds = new Map<string, string>()
        for (const known of await this.supplierNames(workspaceId)) {
            supplierIds.set(known.name.toLowerCase(), known.id)
        }
        let suppliers = 0
        await eachInOrder(
            request.suppliers.filter((supplier) => !supplierIds.has(supplier.name.toLowerCase())),
            async (supplier) => {
                const id = await this.catalogue.writeSupplier(workspaceId, {
                    id: null,
                    name: supplier.name,
                    contact: supplier.contactName ?? "",
                    email: supplier.email ?? null,
                    phone: supplier.phone ?? null,
                    zalo: supplier.zalo ?? null,
                    channel: channelOf(supplier.channel),
                    leadTime: supplier.leadTimeDays,
                    terms: supplier.paymentTerms ?? "",
                    note: "",
                })
                supplierIds.set(supplier.name.toLowerCase(), id)
                suppliers += 1
            },
        )
        return { supplierIds, suppliers }
    }
}
