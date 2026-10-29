import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { DeductResult, DeductedLine, MatchRecipe } from "./inventory.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService, SYSTEM_ACTOR } from "./inventory-movements.service"
import { toInventoryItem } from "./policies/item-row.policy"
import { ITEM_LIMIT, itemRowOf } from "./policies/inventory-row.mapper"
import { formatQty } from "./policies/number-format.policy"
import { matchOrderLine, parseOrderLines } from "./policies/order-lines.policy"
import { InventoryItemEntity, InventoryRecipeEntity, InventoryRecipeLineEntity } from "./persistence/entities"

/** The longest order text kept as evidence. */
const EVIDENCE_MAX = 300

/** The most recipes one deduction reads. */
const RECIPE_LIMIT = 1000

/** The most recipe lines one deduction reads. */
const RECIPE_LINE_LIMIT = 10_000

interface OrderText {
    readonly workspaceId: string
    readonly orderId: string
    readonly orderNo: string
    readonly items: string
}

@Injectable()
/** The deduction of a confirmed order's goods from stock. */
export class InventoryDeductionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly movements: InventoryMovementsService,
        private readonly locations: InventoryLocationsService,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /**
     * The effect of the `inventory` reactor of `order_confirmed`: the confirmed order takes its goods out of stock once per delivery
     * key. The inbox claim shares one transaction with the deduction, so a failure releases the claim and the redelivery runs again;
     * every movement is keyed on the order and the item, so a run that already happened changes nothing twice.
     */
    async deductConfirmedOrder(consumer: string, dedupeKey: string, order: OrderText): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(consumer, dedupeKey, tx))) return
            await this.deductForOrder(order)
        })
    }

    /**
     * A confirmed order takes its goods out of stock: a line that matches a recipe takes the recipe's ingredients, a
     * line that matches an item takes the item (a unit word scales by the item's conversion). One movement per item per
     * order, so a repeated delivery never deducts twice; a line that matches nothing is reported in the Office, never
     * guessed. A workspace with no items does nothing.
     */
    async deductForOrder(order: OrderText): Promise<DeductResult> {
        const nothing: DeductResult = { deducted: [], unmatched: [] }
        const { workspaceId, orderId, orderNo, items: orderText } = order
        if (orderId === "" || orderText.trim() === "") return nothing
        const itemEntities = await this.entityManager.find(InventoryItemEntity, {
            where: { workspaceId, active: true },
            order: { name: "ASC" },
            take: ITEM_LIMIT,
        })
        if (itemEntities.length === 0) return nothing
        const items = itemEntities.map((entity) => toInventoryItem(itemRowOf(entity)))
        const byId = new Map(items.map((item) => [item.id, item]))
        const recipeRows = await this.entityManager.find(InventoryRecipeEntity, {
            select: { id: true, name: true, aliases: true },
            where: { workspaceId, active: true },
            take: RECIPE_LIMIT,
        })
        const lineRows = await this.entityManager.find(InventoryRecipeLineEntity, {
            select: { recipeId: true, itemId: true, qty: true },
            where: { workspaceId },
            take: RECIPE_LINE_LIMIT,
        })
        const recipes: Array<MatchRecipe> = recipeRows.map((row) => ({
            id: row.id,
            name: row.name,
            aliases: row.aliases,
        }))
        const recipeLines = new Map<string, Array<{ itemId: string; qty: number }>>()
        for (const line of lineRows) {
            recipeLines.set(line.recipeId, [
                ...(recipeLines.get(line.recipeId) ?? []),
                { itemId: line.itemId, qty: Number(line.qty) },
            ])
        }
        const take = new Map<string, number>()
        const unmatched: Array<string> = []
        for (const line of parseOrderLines(orderText)) {
            const wholeLine = { raw: line.raw, qty: 1, name: line.raw }
            const match =
                matchOrderLine(line, recipes, items) ??
                (line.raw === line.name ? null : matchOrderLine(wholeLine, recipes, items))
            if (match === null) unmatched.push(line.raw)
            else if (match.kind === "item") take.set(match.id, (take.get(match.id) ?? 0) + match.qty)
            else
                for (const part of recipeLines.get(match.id) ?? [])
                    take.set(part.itemId, (take.get(part.itemId) ?? 0) + part.qty * match.qty)
        }
        const locationId = await this.locations.defaultLocation(workspaceId)
        const deducted: Array<DeductedLine> = []
        await eachInOrder(take, async ([itemId, qty]) => {
            const item = byId.get(itemId)
            if (item === undefined || qty <= 0) return
            const applied = await this.movements.apply(workspaceId, {
                itemId,
                locationId,
                kind: "out",
                delta: -qty,
                reason: this.text("inventory.orderReason", { orderNo }),
                refType: "order",
                refId: orderId,
                refLabel: orderNo,
                by: SYSTEM_ACTOR,
                evidence: orderText.slice(0, EVIDENCE_MAX),
                dedupe: `order:${orderId}:${itemId}`,
            })
            if (applied.applied) deducted.push({ itemId, name: item.name, qty, unit: item.unit, after: applied.after })
        })
        await this.reportDeduction(order, deducted, unmatched)
        await this.movements.replenishLater(
            workspaceId,
            deducted.map((line) => line.itemId),
        )
        return { deducted, unmatched }
    }

    private async reportDeduction(
        order: OrderText,
        deducted: ReadonlyArray<DeductedLine>,
        unmatched: ReadonlyArray<string>,
    ): Promise<void> {
        const { workspaceId, orderNo, items: orderText } = order
        if (deducted.length > 0) {
            const lines = deducted
                .map((line) =>
                    this.text("inventory.orderDeductedLine", {
                        name: line.name,
                        qty: formatQty(line.qty),
                        unit: line.unit,
                        after: formatQty(line.after),
                    }),
                )
                .join("; ")
            await this.office.logEvidence(workspaceId, {
                kind: "inventory.order_deducted",
                actor: this.text("inventory.actorName", {}),
                summary: this.text("inventory.orderDeductedSummary", { orderNo, lines }),
                evidence: orderText.slice(0, EVIDENCE_MAX),
            })
        }
        if (unmatched.length > 0) {
            await this.office.postOffice(
                workspaceId,
                this.text("inventory.orderUnmatchedNote", {
                    orderNo,
                    count: unmatched.length,
                    lines: unmatched.map((line) => `"${line}"`).join(", "),
                }),
            )
        }
    }
}
