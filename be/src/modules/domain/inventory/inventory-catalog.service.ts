import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeLog } from "@modules/domain/module-ops"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { SupplierFields } from "./inventory.contracts"
import type {
    DeleteRecipeParams,
    SaveItemOutput,
    SaveItemParams,
    SaveRecipeOutput,
    SaveRecipeParams,
    SaveSupplierOutput,
    SaveSupplierParams,
    SetItemActiveParams,
} from "./inventory-operations.contracts"
import { InventoryMovementsService } from "./inventory-movements.service"
import { isUniqueViolation } from "./policies/database-error.policy"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { channelOf } from "./policies/supplier-channel.policy"
import { idColumn, savedId } from "./policies/saved-id.policy"
import {
    clip,
    deriveSku,
    isEmailAddress,
    parseCommaList,
    parseUnitPairs,
    uuidOrNull,
} from "./policies/input-text.policy"
import { parseNumber } from "./policies/number-format.policy"

/** Field limits of the catalogue forms. */
const NAME_MAX = 120
const SKU_MAX = 40
const UNIT_MAX = 30
const CATEGORY_MAX = 60
const CONTACT_MAX = 80
const EMAIL_MAX = 200
const PHONE_MAX = 30
const ZALO_MAX = 60
const TERMS_MAX = 200
const NOTE_MAX = 400

/** The longest delivery time a supplier can have, in days. */
const LEAD_TIME_MAX_DAYS = 60

/** The delivery time assumed when none is typed, in days. */
const LEAD_TIME_DEFAULT_DAYS = 2

@Injectable()
/** The catalogue of a workspace: items, suppliers, recipes, and the bulk loads (a pasted table, a starter set). */
export class InventoryCatalogService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly movements: InventoryMovementsService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Creates or updates one item; a new item with an opening quantity gets its first movement. */
    async saveItem(userId: string, workspaceId: string, request: SaveItemParams): Promise<SaveItemOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = clip(request.name, NAME_MAX)
        if (name === "") throw new InventoryError({ code: InventoryErrorCode.ItemNameRequired })
        const existing = uuidOrNull(request.id)
        const typedSku = clip(request.sku, SKU_MAX)
        const sku = existing === null ? (typedSku || deriveSku(name)).toUpperCase() : typedSku
        const sellText = request.sell.trim()
        const rows = idColumn(
            callDbFunction(this.entityManager, "public.inventory_save_item", [
                workspaceId,
                existing,
                sku,
                name,
                clip(request.unit, UNIT_MAX) || this.text("inventory.defaultUnit", {}),
                JSON.stringify(parseUnitPairs(request.units)),
                clip(request.category, CATEGORY_MAX),
                Math.max(0, parseNumber(request.cost)),
                sellText === "" ? null : Math.max(0, parseNumber(sellText)),
                Math.max(0, parseNumber(request.reorderPoint)),
                Math.max(0, parseNumber(request.reorderQty)),
                uuidOrNull(request.supplierId),
                parseCommaList(request.aliases),
            ]),
            "inventory_save_item",
        ).catch((cause: unknown) => {
            if (!isUniqueViolation(cause)) throw cause
            throw new InventoryError({ code: InventoryErrorCode.ItemSkuTaken, params: { sku }, cause })
        })
        const id = await savedId(rows, InventoryErrorCode.ItemNotFound)
        const opening = parseNumber(request.openingQty)
        if (existing === null) {
            await this.recordOpening(workspaceId, actor, id, opening, name, sku)
        }
        return { id }
    }

    private async recordOpening(
        workspaceId: string,
        actor: string,
        itemId: string,
        opening: number,
        name: string,
        sku: string,
    ): Promise<void> {
        if (opening > 0) {
            await this.movements.apply(workspaceId, {
                itemId,
                kind: "adjust",
                delta: opening,
                reason: this.text("inventory.openingStock", {}),
                by: actor,
            })
        }
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.item_created",
            actor,
            summary: this.text("inventory.itemCreatedSummary", { name, sku }),
        })
    }

    /** Switches an item on or off; a switched-off item leaves the stock views and the low-stock check. */
    async setItemActive(userId: string, workspaceId: string, request: SetItemActiveParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await callDbFunction(this.entityManager, "public.inventory_set_item_active", [
            workspaceId,
            request.id,
            request.active,
        ])
    }

    /** Writes one supplier row (a new one when `id` is null) and answers its id; a refusal when the supplier to update is missing. */
    writeSupplier(workspaceId: string, fields: SupplierFields): Promise<string> {
        return savedId(
            idColumn(
                callDbFunction(this.entityManager, "public.inventory_save_supplier", [
                    workspaceId,
                    fields.id,
                    fields.name,
                    fields.contact,
                    fields.email,
                    fields.phone,
                    fields.zalo,
                    fields.channel,
                    fields.leadTime,
                    fields.terms,
                    fields.note,
                ]),
                "inventory_save_supplier",
            ),
            InventoryErrorCode.SupplierNotFound,
        )
    }

    /** Creates or updates one supplier. */
    async saveSupplier(userId: string, workspaceId: string, request: SaveSupplierParams): Promise<SaveSupplierOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = clip(request.name, NAME_MAX)
        if (name === "") throw new InventoryError({ code: InventoryErrorCode.SupplierNameRequired })
        const email = clip(request.email, EMAIL_MAX).toLowerCase()
        if (email !== "" && !isEmailAddress(email)) {
            throw new InventoryError({ code: InventoryErrorCode.SupplierEmailInvalid })
        }
        const id = await this.writeSupplier(workspaceId, {
            id: uuidOrNull(request.id),
            name,
            contact: clip(request.contactName, CONTACT_MAX),
            email: email === "" ? null : email,
            phone: clip(request.phone, PHONE_MAX) || null,
            zalo: clip(request.zalo, ZALO_MAX) || null,
            channel: channelOf(request.channel),
            leadTime: Math.min(
                LEAD_TIME_MAX_DAYS,
                Math.max(0, Math.round(parseNumber(request.leadTime, LEAD_TIME_DEFAULT_DAYS))),
            ),
            terms: clip(request.terms, TERMS_MAX),
            note: clip(request.note, NOTE_MAX),
        })
        return { id }
    }

    /** Creates or replaces one recipe with its ingredient lines in one step. */
    async saveRecipe(userId: string, workspaceId: string, request: SaveRecipeParams): Promise<SaveRecipeOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = clip(request.name, NAME_MAX)
        if (name === "") throw new InventoryError({ code: InventoryErrorCode.RecipeNameRequired })
        const lines = request.lines.flatMap((line) => {
            const itemId = uuidOrNull(line.itemId)
            const qty = parseNumber(line.qty)
            return itemId !== null && qty > 0 ? [{ itemId, qty }] : []
        })
        if (lines.length === 0) throw new InventoryError({ code: InventoryErrorCode.RecipeLinesRequired })
        const id = await savedId(
            idColumn(
                callDbFunction(this.entityManager, "public.inventory_save_recipe", [
                    workspaceId,
                    uuidOrNull(request.id),
                    name,
                    parseCommaList(request.aliases),
                    lines.map((line) => line.itemId),
                    lines.map((line) => line.qty),
                ]),
                "inventory_save_recipe",
            ),
            InventoryErrorCode.RecipeNotFound,
        )
        return { id }
    }

    /** Deletes one recipe with its lines. */
    async deleteRecipe(userId: string, workspaceId: string, request: DeleteRecipeParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await callDbFunction(this.entityManager, "public.inventory_delete_recipe", [workspaceId, request.id])
    }
}
