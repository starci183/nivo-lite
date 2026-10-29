import { Injectable } from "@nestjs/common"
import { Any, IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { isReplenishPayload } from "@modules/queues/inventory-replenish"
import type { DraftOptions, DraftOutcome, LowItem } from "./inventory.contracts"
import type { DraftLowStockOutput } from "./inventory-operations.contracts"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryMovementsService, SYSTEM_ACTOR } from "./inventory-movements.service"
import { DEFAULT_LEAD_TIME_DAYS, InventoryOrdersService } from "./inventory-orders.service"
import { InventoryLogEvent } from "./inventory.log-events"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { toInventoryItem } from "./policies/item-row.policy"

import { ITEM_LIMIT, OPEN_PO_STATUSES, itemRowOf } from "./policies/inventory-row.mapper"
import { columnNumber, formatMoney } from "./policies/number-format.policy"
import { stockStatus, suggestOrderQty } from "./policies/stock.policy"
import { InventoryItemEntity, InventoryPoLineEntity, InventoryPurchaseOrderEntity } from "./persistence/entities"
import { AuthorityRulesService } from "@modules/domain/authority-rules"

interface TotalRow {
    readonly item_id: string
    readonly qty: number | string
}

/** The most items one on-order read answers. */
const ON_ORDER_LIMIT = 5000

/** The most lines of one order the draft extension compares with. */
const PO_LINE_LIMIT = 1000

/** The most orders one approval request checks. */
const APPROVAL_LIMIT = 200

@Injectable()
/** Replenishment: finding the items at their reorder point and drafting one purchase order per supplier for them. */
export class InventoryReplenishService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        @InjectLogger() private readonly logger: Logger,
        private readonly movements: InventoryMovementsService,
        private readonly orders: InventoryOrdersService,
        private readonly dispatch: InventoryDispatchService,
        private readonly rules: AuthorityRulesService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** The items at or below their reorder point; an item with no reorder point is never low. */
    async lowItems(workspaceId: string, itemIds?: ReadonlyArray<string>): Promise<Array<LowItem>> {
        const rows = await this.entityManager.find(InventoryItemEntity, {
            where:
                itemIds === undefined
                    ? { workspaceId, active: true }
                    : { workspaceId, active: true, id: Any([...itemIds]) },
            order: { name: "ASC" },
            take: ITEM_LIMIT,
        })
        const items = rows.map((row) => toInventoryItem(itemRowOf(row)))
        const totals = await this.movements.totals(workspaceId, itemIds ?? items.map((item) => item.id))
        const low: Array<LowItem> = []
        for (const item of items) {
            const total = totals.get(item.id) ?? 0
            const status = stockStatus(item, total)
            if (item.reorderPoint > 0 && (status === "out" || status === "low")) low.push({ item, total, status })
        }
        return low
    }

    /** Drafts orders for the low items on behalf of a person and asks the owner to approve the ones that have a supplier. */
    async draftLowStock(userId: string, workspaceId: string): Promise<DraftLowStockOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const outcome = await this.draftLow(workspaceId, { by: actor })
        return { drafted: outcome.poIds.length, low: outcome.lowCount }
    }

    /** The effect of one replenish-stock job; a payload of any other job changes nothing. */
    async replenishJob(payload: object): Promise<void> {
        if (isReplenishPayload(payload)) await this.draftLow(payload.workspaceId, { itemIds: payload.itemIds })
    }

    /**
     * Drafts purchase orders for the items below their reorder point that no open order already covers: one draft per supplier
     * (an existing draft is extended, never duplicated). Then each draft with a supplier is put before the owner.
     */
    async draftLow(workspaceId: string, options: DraftOptions = {}): Promise<DraftOutcome> {
        const by = options.by ?? SYSTEM_ACTOR
        const low = await this.lowItems(workspaceId, options.itemIds)
        if (low.length === 0) return { poIds: [], lowCount: 0, skipped: [] }
        const rule = await this.rules.ruleFor({ workspaceId }, "draft_purchase_order", null)
        if (rule?.mode === "never")
            return { poIds: [], lowCount: low.length, skipped: low.map((entry) => entry.item.name) }
        const onOrderRows = await this.entityManager
            .createQueryBuilder(InventoryPoLineEntity, "line")
            .select("line.item_id", "item_id")
            .addSelect("SUM(GREATEST(line.qty_ordered - line.qty_received, 0))", "qty")
            .innerJoin(InventoryPurchaseOrderEntity, "po", "po.id = line.po_id")
            .where("po.workspace_id = :workspaceId AND po.status IN (:...open)", {
                workspaceId,
                open: [...OPEN_PO_STATUSES],
            })
            .groupBy("line.item_id")
            .limit(ON_ORDER_LIMIT)
            .getRawMany<TotalRow>()
        const onOrder = new Map(onOrderRows.map((row) => [row.item_id, columnNumber(row.qty)]))
        // The inventory position is what is on the shelf plus what is already ordered; order only when it is still at or below the reorder point.
        const need = low.filter((entry) => entry.total + (onOrder.get(entry.item.id) ?? 0) <= entry.item.reorderPoint)
        const skipped = low.filter((entry) => !need.includes(entry)).map((entry) => entry.item.name)
        const groups = new Map<string | null, Array<LowItem>>()
        for (const entry of need)
            groups.set(entry.item.supplierId, [...(groups.get(entry.item.supplierId) ?? []), entry])
        const poIds: Array<string> = []
        await eachInOrder(groups, async ([supplierId, entries]) => {
            poIds.push(await this.draftForSupplier(workspaceId, by, supplierId, entries))
        })
        if (options.requestApproval !== false) await this.requestApprovals(workspaceId, by, poIds)
        return { poIds, lowCount: low.length, skipped }
    }

    private async draftForSupplier(
        workspaceId: string,
        by: string,
        supplierId: string | null,
        entries: ReadonlyArray<LowItem>,
    ): Promise<string> {
        const wanted = entries.map((entry) => ({
            itemId: entry.item.id,
            qty: suggestOrderQty(entry.item, entry.total),
            unitCost: entry.item.costVnd,
        }))
        // A null supplier means "the draft of no supplier": a null in a where object would match every draft.
        const existing = await this.entityManager.findOne(InventoryPurchaseOrderEntity, {
            select: { id: true },
            where: { workspaceId, status: "draft", supplierId: supplierId === null ? IsNull() : supplierId },
            order: { createdAt: "ASC" },
        })
        let poId: string
        if (existing === null) {
            poId = await this.orders.createPoRecord(workspaceId, {
                supplierId,
                lines: wanted,
                by,
                source: "auto",
                leadTimeDays:
                    supplierId === null
                        ? DEFAULT_LEAD_TIME_DAYS
                        : await this.orders.leadTimeOf(workspaceId, supplierId),
            })
        } else {
            poId = existing.id
            const have = new Set(
                (
                    await this.entityManager.find(InventoryPoLineEntity, {
                        select: { itemId: true },
                        where: { poId },
                        take: PO_LINE_LIMIT,
                    })
                ).map((row) => row.itemId),
            )
            const add = wanted.filter((line) => !have.has(line.itemId))
            if (add.length > 0) await this.orders.addLines(workspaceId, poId, add)
        }
        const summary = await this.entityManager.findOne(InventoryPurchaseOrderEntity, {
            select: { poNo: true, totalVnd: true },
            where: { id: poId },
        })
        const poNo = summary?.poNo ?? ""
        const names = entries.map((entry) => entry.item.name).join(", ")
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.po_drafted",
            actor: this.text("inventory.draftActor", {}),
            summary: this.text("inventory.poDraftedSummary", { poNo, names }),
            evidence: formatMoney(columnNumber(summary?.totalVnd)),
        })
        await this.office.logDecision(workspaceId, {
            department: "inventory",
            action: "draft_purchase_order",
            decidedBy: SYSTEM_ACTOR,
            deciderKind: "policy",
            outcome: "auto_done",
            reason: "routine",
            note: this.text("inventory.poDraftedNote", { poNo, names }),
        })
        return poId
    }

    /** Asks the owner to approve each draft that has a supplier; a failure for one draft is logged and does not stop the others. */
    async requestApprovals(workspaceId: string, by: string, poIds: ReadonlyArray<string>): Promise<void> {
        if (poIds.length === 0) return
        const withSupplier = new Set(
            (
                await this.entityManager.find(InventoryPurchaseOrderEntity, {
                    select: { id: true },
                    where: { id: Any([...poIds]), supplierId: Not(IsNull()) },
                    take: APPROVAL_LIMIT,
                })
            ).map((row) => row.id),
        )
        await eachInOrder(
            poIds.filter((id) => withSupplier.has(id)),
            (poId) =>
                this.dispatch.askToSend(workspaceId, by, poId, "order").catch((cause: unknown) => {
                    this.logger.error(InventoryLogEvent.RequestSendFailed, cause, { poId })
                }),
        )
    }
}
