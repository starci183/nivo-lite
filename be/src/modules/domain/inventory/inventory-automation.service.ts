import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { DraftOutcome, OverdueResult, WeeklyReport } from "./inventory.contracts"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryMovementsService, SYSTEM_ACTOR } from "./inventory-movements.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { columnNumber, formatDay, formatMoney, formatQty } from "./policies/number-format.policy"
import { toInventoryItem } from "./policies/item-row.policy"
import type { ItemRowColumns } from "./policies/item-row.policy"
import { stockStatus } from "./policies/stock.policy"
import {
    SELECT_ACTIVE_ITEMS,
    SELECT_MOVEMENTS_SINCE,
    SELECT_OPEN_POS,
    SELECT_OVERDUE_POS,
    SELECT_PO_FOR_REMINDER,
} from "./persistence/inventory.sql"

const DAY_MS = 86_400_000

/** How many low items and open orders the report lists by name. */
const LOW_LIST_MAX = 8
const ORDER_LIST_MAX = 6

interface MovementRow {
    readonly kind: string
    readonly qty: number | string
    readonly unit_cost_vnd: number | string | null
    readonly item_id: string
}

interface OpenPoRow {
    readonly po_no: string
    readonly status: string
    readonly total_vnd: number | string
    readonly supplier_name: string | null
}

interface ReminderPoRow {
    readonly id: string
    readonly po_no: string
    readonly status: string
    readonly reminders: number
    readonly expected_at: string | null
    readonly supplier_name: string | null
}

@Injectable()
/** The routine inventory jobs the automation engine runs: the daily low-stock draft, the weekly report and the overdue-supplier reminder. */
export class InventoryAutomationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly mail: OutboundMail,
        @InjectClock() private readonly clock: Clock,
        private readonly movements: InventoryMovementsService,
        private readonly replenish: InventoryReplenishService,
        private readonly dispatch: InventoryDispatchService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Drafts one order per supplier for the low items, says so in the Office and asks the owner to approve each; nothing leaves without that approval. */
    async runLowStock(workspaceId: string, actor: string): Promise<DraftOutcome> {
        const outcome = await this.replenish.draftLow(workspaceId, { by: actor, requestApproval: false })
        if (outcome.poIds.length === 0) return outcome
        await this.office.postOffice(
            workspaceId,
            this.text("inventory.lowStockNote", { low: outcome.lowCount, orders: outcome.poIds.length }),
        )
        await this.replenish.requestApprovals(workspaceId, actor, outcome.poIds)
        return outcome
    }

    /** Posts the weekly stock report to the Office and mails it to `email` when it is not empty. */
    async runWeeklyReport(workspaceId: string, email: string): Promise<WeeklyReport> {
        const items = (await this.entityManager.query<Array<ItemRowColumns>>(SELECT_ACTIVE_ITEMS, [workspaceId])).map(
            toInventoryItem,
        )
        const totals = await this.movements.totals(workspaceId)
        const valueVnd = items.reduce((sum, item) => sum + Math.max(0, totals.get(item.id) ?? 0) * item.costVnd, 0)
        const low = items.filter((item) => {
            const status = stockStatus(item, totals.get(item.id) ?? 0)
            return (status === "out" || status === "low") && item.reorderPoint > 0
        })
        const since = new Date(this.clock.now().getTime() - 7 * DAY_MS).toISOString()
        const moves = await this.entityManager.query<Array<MovementRow>>(SELECT_MOVEMENTS_SINCE, [workspaceId, since])
        const costOf = new Map(items.map((item) => [item.id, item.costVnd]))
        const goodsOut = moves
            .filter((move) => move.kind === "out")
            .reduce((sum, move) => sum + Math.abs(columnNumber(move.qty)) * (costOf.get(move.item_id) ?? 0), 0)
        const goodsIn = moves
            .filter((move) => move.kind === "in")
            .reduce(
                (sum, move) =>
                    sum +
                    columnNumber(move.qty) * (columnNumber(move.unit_cost_vnd) || (costOf.get(move.item_id) ?? 0)),
                0,
            )
        const orders = await this.entityManager.query<Array<OpenPoRow>>(SELECT_OPEN_POS, [workspaceId])
        const shop = await this.office.workspaceName(workspaceId)
        const lowLine =
            low.length === 0
                ? this.text("inventory.reportNoLow", {})
                : this.text("inventory.reportLow", {
                      count: low.length,
                      list: low
                          .slice(0, LOW_LIST_MAX)
                          .map((item) =>
                              this.text("inventory.reportLowItem", {
                                  name: item.name,
                                  qty: formatQty(totals.get(item.id) ?? 0),
                                  unit: item.unit,
                              }),
                          )
                          .join("; "),
                  })
        const ordersLine =
            orders.length === 0
                ? this.text("inventory.reportNoOrders", {})
                : this.text("inventory.reportOrders", {
                      count: orders.length,
                      list: orders
                          .slice(0, ORDER_LIST_MAX)
                          .map((order) =>
                              this.text("inventory.reportOrderItem", {
                                  poNo: order.po_no,
                                  supplier: order.supplier_name ?? this.text("inventory.reportNoSupplier", {}),
                                  total: formatMoney(columnNumber(order.total_vnd)),
                                  status: this.text(`inventory.poStatus.${order.status}`, {}),
                              }),
                          )
                          .join("; "),
                  })
        const text = [
            this.text("inventory.reportTitle", { shop }),
            this.text("inventory.reportValue", { value: formatMoney(valueVnd), count: items.length }),
            this.text("inventory.reportFlow", { goodsIn: formatMoney(goodsIn), goodsOut: formatMoney(goodsOut) }),
            lowLine,
            ordersLine,
        ].join("\n")
        await this.office.postOffice(workspaceId, text)
        const mailed =
            email === ""
                ? null
                : await this.mail.send({
                      workspaceId,
                      to: email,
                      subject: this.text("inventory.reportSubject", { shop }),
                      title: this.text("inventory.reportMailTitle", {}),
                      body: text,
                      purpose: "inventory_weekly_report",
                      audience: "owner",
                  })
        return { text, valueVnd, lowCount: low.length, openOrders: orders.length, email: mailed?.status ?? "none" }
    }

    /** The sent orders that are past due (after `graceDays`) and still deserve a reminder: at most two per order, two days apart. */
    async overdueOrderIds(workspaceId: string, graceDays: number): Promise<Array<string>> {
        const now = this.clock.now().getTime()
        const cutoffDay = new Date(now - Math.max(0, graceDays) * DAY_MS).toISOString().slice(0, 10)
        const lastReminderCutoff = new Date(now - 2 * DAY_MS).toISOString()
        const rows = await this.entityManager.query<Array<{ id: string }>>(SELECT_OVERDUE_POS, [
            workspaceId,
            cutoffDay,
            lastReminderCutoff,
        ])
        return rows.map((row) => row.id)
    }

    /** Writes a polite reminder for the supplier of an overdue order and asks the owner to approve sending it. */
    async remindOverdue(workspaceId: string, poId: string): Promise<OverdueResult> {
        const [po] = await this.entityManager.query<Array<ReminderPoRow>>(SELECT_PO_FOR_REMINDER, [workspaceId, poId])
        if (po === undefined || (po.status !== "sent" && po.status !== "partially_received")) {
            return { state: "skipped", workItemId: null, reminder: 0, poNo: po?.po_no ?? "" }
        }
        const who = po.supplier_name ?? this.text("inventory.supplierFallback", {})
        const due =
            po.expected_at === null ? "" : this.text("inventory.overdueDue", { date: formatDay(po.expected_at) })
        await this.office.postOffice(workspaceId, this.text("inventory.overdueNote", { poNo: po.po_no, who, due }))
        const result = await this.dispatch.askToSend(workspaceId, SYSTEM_ACTOR, po.id, "reminder")
        return {
            state: result.status === "waiting_decision" ? "asked" : "sent",
            workItemId: result.workItemId,
            reminder: po.reminders + 1,
            poNo: po.po_no,
        }
    }
}
