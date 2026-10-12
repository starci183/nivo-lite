import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { InventoryOrderQueue, isDeductOrderPayload } from "@modules/queues/inventory-order"
import type { DeductResult, DeductedLine, MatchRecipe } from "./inventory.contracts"
import type { DeductOrderParams } from "./inventory-operations.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService, SYSTEM_ACTOR } from "./inventory-movements.service"
import { ANY_MEMBER } from "./policies/access-roles.policy"
import { toInventoryItem } from "./policies/item-row.policy"
import type { ItemRowColumns } from "./policies/item-row.policy"
import { formatQty } from "./policies/number-format.policy"
import { matchOrderLine, parseOrderLines } from "./policies/order-lines.policy"
import { SELECT_ACTIVE_ITEMS, SELECT_ACTIVE_RECIPES, SELECT_RECIPE_LINES } from "./persistence/inventory.sql"
import type { InventoryRecipeLinesRow, InventoryRecipesRow } from "./persistence/inventory.rows"

/** The longest order text kept as evidence. */
const EVIDENCE_MAX = 300

type RecipeRow = Pick<InventoryRecipesRow, "id" | "name" | "aliases">

type RecipeLineRow = Pick<InventoryRecipeLinesRow, "recipe_id" | "item_id" | "qty">

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
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly movements: InventoryMovementsService,
        private readonly locations: InventoryLocationsService,
        private readonly orderQueue: InventoryOrderQueue,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Schedules the deduction of a confirmed order's goods; the job exists exactly when the request is stored. */
    async enqueueDeduct(userId: string, workspaceId: string, request: DeductOrderParams): Promise<void> {
        await this.members.require(userId, workspaceId, ANY_MEMBER)
        await this.entityManager.transaction((tx) =>
            this.orderQueue.enqueueDeductOrder(
                { workspaceId, orderId: request.orderId, orderNo: request.orderNo, items: request.items },
                tx,
            ),
        )
    }

    /** The effect of one deduct-order job; a payload of any other job changes nothing. */
    async deductOrderJob(payload: object): Promise<void> {
        if (isDeductOrderPayload(payload)) await this.deductForOrder(payload)
    }

    /**
     * A confirmed order takes its goods out of stock: a line that matches a recipe takes the recipe's ingredients, a line
     * that matches an item takes the item (a unit word scales by the item's conversion). One movement per item per order,
     * so a repeated delivery never deducts twice; a line that matches nothing is reported in the Office, never guessed.
     * A workspace with no items does nothing.
     */
    async deductForOrder(order: OrderText): Promise<DeductResult> {
        const nothing: DeductResult = { deducted: [], unmatched: [] }
        const { workspaceId, orderId, orderNo, items: orderText } = order
        if (orderId === "" || orderText.trim() === "") return nothing
        const itemRows = await this.entityManager.query<Array<ItemRowColumns>>(SELECT_ACTIVE_ITEMS, [workspaceId])
        if (itemRows.length === 0) return nothing
        const items = itemRows.map(toInventoryItem)
        const byId = new Map(items.map((item) => [item.id, item]))
        const recipeRows = await this.entityManager.query<Array<RecipeRow>>(SELECT_ACTIVE_RECIPES, [workspaceId])
        const lineRows = await this.entityManager.query<Array<RecipeLineRow>>(SELECT_RECIPE_LINES, [workspaceId])
        const recipes: Array<MatchRecipe> = recipeRows.map((row) => ({
            id: row.id,
            name: row.name,
            aliases: row.aliases,
        }))
        const recipeLines = new Map<string, Array<{ itemId: string; qty: number }>>()
        for (const line of lineRows) {
            recipeLines.set(line.recipe_id, [
                ...(recipeLines.get(line.recipe_id) ?? []),
                { itemId: line.item_id, qty: Number(line.qty) },
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
        await this.movements.replenishLater(
            workspaceId,
            deducted.map((line) => line.itemId),
        )
        return { deducted, unmatched }
    }
}
