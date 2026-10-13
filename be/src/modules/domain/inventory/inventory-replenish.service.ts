import { Injectable } from "@nestjs/common"
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

import type { ItemRowColumns } from "./policies/item-row.policy"
import { columnNumber, formatMoney } from "./policies/number-format.policy"
import { stockStatus, suggestOrderQty } from "./policies/stock.policy"
import {
    SELECT_ACTIVE_ITEMS,
    SELECT_ACTIVE_ITEMS_BY_ID,
    SELECT_DRAFT_PO,
    SELECT_ON_ORDER,
    SELECT_PO_ITEM_IDS,
    SELECT_PO_SUMMARY,
    SELECT_POS_WITH_SUPPLIER,
    SELECT_RULE_MODE,
} from "./persistence/inventory.sql"

interface IdRow {
    readonly id: string
}

interface TotalRow {
    readonly item_id: string
    readonly qty: number | string
}

interface PoSummaryRow {
    readonly po_no: string
    readonly total_vnd: number | string
}

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
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** The items at or below their reorder point; an item with no reorder point is never low. */
    async lowItems(workspaceId: string, itemIds?: ReadonlyArray<string>): Promise<Array<LowItem>> {
        const rows =
            itemIds === undefined
                ? await this.entityManager.query<Array<ItemRowColumns>>(SELECT_ACTIVE_ITEMS, [workspaceId])
                : await this.entityManager.query<Array<ItemRowColumns>>(SELECT_ACTIVE_ITEMS_BY_ID, [
                      workspaceId,
                      [...itemIds],
                  ])
        const items = rows.map(toInventoryItem)
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
        const [rule] = await this.entityManager.query<Array<{ mode: string }>>(SELECT_RULE_MODE, [
            workspaceId,
            "draft_purchase_order",
        ])
        if (rule?.mode === "never")
            return { poIds: [], lowCount: low.length, skipped: low.map((entry) => entry.item.name) }
        const onOrder = new Map(
            (await this.entityManager.query<Array<TotalRow>>(SELECT_ON_ORDER, [workspaceId])).map((row) => [
                row.item_id,
                columnNumber(row.qty),
            ]),
        )
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
        const [existing] = await this.entityManager.query<Array<IdRow>>(SELECT_DRAFT_PO, [workspaceId, supplierId])
        let poId: string
        if (existing === undefined) {
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
                (await this.entityManager.query<Array<{ item_id: string }>>(SELECT_PO_ITEM_IDS, [poId])).map(
                    (row) => row.item_id,
                ),
            )
            const add = wanted.filter((line) => !have.has(line.itemId))
            if (add.length > 0) await this.orders.addLines(workspaceId, poId, add)
        }
        const [summary] = await this.entityManager.query<Array<PoSummaryRow>>(SELECT_PO_SUMMARY, [poId])
        const poNo = summary?.po_no ?? ""
        const names = entries.map((entry) => entry.item.name).join(", ")
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.po_drafted",
            actor: this.text("inventory.draftActor", {}),
            summary: this.text("inventory.poDraftedSummary", { poNo, names }),
            evidence: formatMoney(columnNumber(summary?.total_vnd)),
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
            (await this.entityManager.query<Array<IdRow>>(SELECT_POS_WITH_SUPPLIER, [[...poIds]])).map((row) => row.id),
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
