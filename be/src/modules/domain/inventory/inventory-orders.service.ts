import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { CreatePoInput, LoadedPo, PoLine, PoLineInput, PoSupplier } from "./inventory.contracts"
import type {
    CancelPoParams,
    CreatePoOutput,
    CreatePoParams,
    UpdatePoDraftParams,
} from "./inventory-operations.contracts"
import { isIsoDay, uuidOrNull } from "./policies/input-text.policy"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { columnNumber, parseNumber } from "./policies/number-format.policy"
import { poNumberOf, poNumberPrefix } from "./policies/purchase-order.policy"
import type { InventoryPoLinesRow, InventoryPurchaseOrdersRow } from "./persistence/inventory.rows"
import {
    ADD_PO_LINES,
    CANCEL_PO,
    EDIT_PO_DRAFT,
    INSERT_PO,
    RECOMPUTE_PO_TOTAL,
    SELECT_LAST_PO_NO,
    SELECT_PO,
    SELECT_PO_LINES,
    SELECT_PO_STATUS,
    SELECT_SUPPLIER_LEAD_TIME,
} from "./persistence/inventory.sql"

/** The delivery time assumed when a supplier has none, in days. */
export const DEFAULT_LEAD_TIME_DAYS = 2

/** How often a fresh purchase order number is tried before giving up. */
const PO_NUMBER_ATTEMPTS = 4

/** Day length in milliseconds. */
const DAY_MS = 86_400_000

type PoRow = Pick<
    InventoryPurchaseOrdersRow,
    "id" | "po_no" | "supplier_id" | "status" | "total_vnd" | "expected_at" | "message" | "reminders"
> & {
    readonly supplier_name: string | null
    readonly supplier_contact: string | null
    readonly supplier_email: string | null
    readonly supplier_channel: string | null
    readonly supplier_lead_time: number | null
}

type PoLineRow = Pick<InventoryPoLinesRow, "id" | "item_id" | "qty_ordered" | "qty_received" | "unit_cost_vnd"> & {
    readonly item_name: string | null
    readonly item_unit: string | null
}

interface IdRow {
    readonly id: string | null
}

interface SupplierLeadRow {
    readonly lead_time_days: number
}

interface CancelledRow {
    readonly po_no: string
    readonly work_item_id: string | null
}

const channelOf = (channel: string | null): PoSupplier["channel"] =>
    channel === "zalo" || channel === "phone" ? channel : "email"

@Injectable()
/** Purchase orders: loading, creating, editing a draft and cancelling. */
export class InventoryOrdersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly gate: ApprovalGate,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Loads one purchase order with its supplier and lines; a refusal when the workspace has no such order. */
    async loadPo(workspaceId: string, poId: string): Promise<LoadedPo> {
        const [row] = await this.entityManager.query<Array<PoRow>>(SELECT_PO, [workspaceId, poId])
        if (row === undefined) throw new InventoryError({ code: InventoryErrorCode.PoNotFound })
        const lineRows = await this.entityManager.query<Array<PoLineRow>>(SELECT_PO_LINES, [poId])
        const lines: Array<PoLine> = lineRows.map((line) => ({
            id: line.id,
            itemId: line.item_id,
            qtyOrdered: columnNumber(line.qty_ordered),
            qtyReceived: columnNumber(line.qty_received),
            unitCost: columnNumber(line.unit_cost_vnd),
            itemName: line.item_name,
            itemUnit: line.item_unit,
        }))
        const supplier: PoSupplier | null =
            row.supplier_name === null
                ? null
                : {
                      name: row.supplier_name,
                      contactName: row.supplier_contact ?? "",
                      email: row.supplier_email,
                      channel: channelOf(row.supplier_channel),
                      leadTimeDays: row.supplier_lead_time ?? DEFAULT_LEAD_TIME_DAYS,
                  }
        return {
            id: row.id,
            poNo: row.po_no,
            supplierId: row.supplier_id,
            status: row.status,
            totalVnd: columnNumber(row.total_vnd),
            expectedAt: row.expected_at,
            message: row.message,
            reminders: row.reminders,
            supplier,
            lines,
        }
    }

    /** The delivery time of a supplier in days, or the default when it has none. */
    async leadTimeOf(workspaceId: string, supplierId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<SupplierLeadRow>>(SELECT_SUPPLIER_LEAD_TIME, [
            workspaceId,
            supplierId,
        ])
        return row?.lead_time_days ?? DEFAULT_LEAD_TIME_DAYS
    }

    /** Creates a draft order with its lines and total in one transaction; a clashing number is retried with the next one. */
    createPoRecord(workspaceId: string, input: CreatePoInput): Promise<string> {
        const expected =
            input.expectedAt ??
            new Date(this.clock.now().getTime() + input.leadTimeDays * DAY_MS).toISOString().slice(0, 10)
        return this.entityManager.transaction(async (tx) => {
            const id = await this.insertPo(tx, workspaceId, input, expected, PO_NUMBER_ATTEMPTS)
            await this.writeLines(tx, workspaceId, id, input.lines)
            return id
        })
    }

    private async insertPo(
        tx: EntityManager,
        workspaceId: string,
        input: CreatePoInput,
        expected: string,
        attemptsLeft: number,
    ): Promise<string> {
        if (attemptsLeft === 0) throw new InventoryError({ code: InventoryErrorCode.PoNumberUnavailable })
        const prefix = poNumberPrefix(this.clock.now())
        const [last] = await tx.query<Array<{ po_no: string }>>(SELECT_LAST_PO_NO, [workspaceId, `${prefix}%`])
        const [made] = await tx.query<Array<IdRow>>(INSERT_PO, [
            workspaceId,
            poNumberOf(prefix, last?.po_no ?? null),
            input.supplierId,
            expected,
            "",
            input.source,
            input.by,
        ])
        return made?.id ?? (await this.insertPo(tx, workspaceId, input, expected, attemptsLeft - 1))
    }

    private async writeLines(
        tx: EntityManager,
        workspaceId: string,
        poId: string,
        lines: ReadonlyArray<PoLineInput>,
    ): Promise<void> {
        await tx.query(ADD_PO_LINES, [
            workspaceId,
            poId,
            lines.map((line) => line.itemId),
            lines.map((line) => line.qty),
            lines.map((line) => line.unitCost),
        ])
        await tx.query(RECOMPUTE_PO_TOTAL, [poId])
    }

    /** Adds lines to an existing draft and refreshes its total, in one transaction. */
    addLines(workspaceId: string, poId: string, lines: ReadonlyArray<PoLineInput>): Promise<void> {
        return this.entityManager.transaction((tx) => this.writeLines(tx, workspaceId, poId, lines))
    }

    /** Creates a purchase order by hand. */
    async createPo(userId: string, workspaceId: string, request: CreatePoParams): Promise<CreatePoOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const lines = request.lines.flatMap((line) => {
            const itemId = uuidOrNull(line.itemId)
            const qty = parseNumber(line.qty)
            return itemId !== null && qty > 0
                ? [{ itemId, qty, unitCost: Math.max(0, parseNumber(line.unitCost)) }]
                : []
        })
        if (lines.length === 0) throw new InventoryError({ code: InventoryErrorCode.PoLinesRequired })
        const supplierId = uuidOrNull(request.supplierId)
        const leadTimeDays =
            supplierId === null ? DEFAULT_LEAD_TIME_DAYS : await this.leadTimeOf(workspaceId, supplierId)
        const id = await this.createPoRecord(workspaceId, {
            supplierId,
            lines,
            by: actor,
            source: "manual",
            leadTimeDays,
            ...(isIsoDay(request.expectedAt) ? { expectedAt: request.expectedAt } : {}),
        })
        return { id }
    }

    /** Edits a draft order: its supplier, expected day, quantities and prices; a line set to zero is removed. */
    async updatePoDraft(userId: string, workspaceId: string, request: UpdatePoDraftParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const [po] = await this.entityManager.query<Array<{ id: string; status: string }>>(SELECT_PO_STATUS, [
            workspaceId,
            request.poId,
        ])
        if (po === undefined) throw new InventoryError({ code: InventoryErrorCode.PoNotFound })
        if (po.status !== "draft") throw new InventoryError({ code: InventoryErrorCode.PoNotDraft })
        await this.entityManager.query(EDIT_PO_DRAFT, [
            po.id,
            uuidOrNull(request.supplierId),
            isIsoDay(request.expectedAt) ? request.expectedAt : null,
            request.lines.map((line) => line.lineId),
            request.lines.map((line) => parseNumber(line.qty)),
            request.lines.map((line) => Math.max(0, parseNumber(line.unitCost))),
        ])
    }

    /** Cancels an order that has not been received and closes the decision still waiting for it. */
    async cancelPo(userId: string, workspaceId: string, request: CancelPoParams): Promise<void> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const [row] = await this.entityManager.query<Array<CancelledRow>>(CANCEL_PO, [workspaceId, request.poId])
        if (row === undefined) throw new InventoryError({ code: InventoryErrorCode.PoNotCancellable })
        if (row.work_item_id !== null) {
            await this.gate.decide({
                workspaceId,
                workItemId: row.work_item_id,
                decision: "rejected",
                decidedBy: userId,
            })
        }
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.po_cancelled",
            actor,
            summary: this.catalog.get("inventory.poCancelledSummary", { poNo: row.po_no }, "vi"),
        })
    }
}
