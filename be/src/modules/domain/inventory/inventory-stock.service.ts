import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { AdjustInput } from "./inventory.contracts"
import type {
    AdjustStockOutput,
    AdjustStockParams,
    StockTakeOutput,
    StockTakeParams,
    TransferStockOutput,
    TransferStockParams,
} from "./inventory-operations.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { fieldNumber, fieldText } from "./policies/gate-fields.policy"
import { ANY_MEMBER } from "./policies/access-roles.policy"
import { clip, uuidOrNull } from "./policies/input-text.policy"
import { toInventoryItem } from "./policies/item-row.policy"
import type { ItemRowColumns } from "./policies/item-row.policy"
import { formatMoney, formatQty } from "./policies/number-format.policy"
import { isSmallAdjustment } from "./policies/stock.policy"
import { SELECT_ITEM, SELECT_ITEM_LABEL, SELECT_LOCATION_NAMES } from "./persistence/inventory.sql"

/** Most counted lines one stock count takes. */
const COUNT_LINES_MAX = 500

/** The longest reason a person types. */
const REASON_MAX = 160

/** The longest transfer note. */
const NOTE_MAX = 100

interface LocationNameRow {
    readonly id: string
    readonly name: string
}

interface ItemLabelRow {
    readonly name: string
    readonly unit: string
}

@Injectable()
/** Stock quantities: manual adjustments (big ones wait for the owner), transfers between locations, stock counts and the */
export class InventoryStockService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly gate: ApprovalGate,
        @InjectClock() private readonly clock: Clock,
        private readonly movements: InventoryMovementsService,
        private readonly locations: InventoryLocationsService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Changes one item's quantity by hand, from a signed change or a counted level. */
    async adjustStock(userId: string, workspaceId: string, request: AdjustStockParams): Promise<AdjustStockOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, ANY_MEMBER)
        if (request.delta === undefined && request.counted === undefined) {
            throw new InventoryError({ code: InventoryErrorCode.AdjustQtyRequired })
        }
        const locationId = uuidOrNull(request.locationId)
        return await this.adjust(workspaceId, actor, {
            itemId: request.itemId,
            ...(locationId === null ? {} : { locationId }),
            ...(request.delta === undefined ? {} : { delta: request.delta }),
            ...(request.counted === undefined ? {} : { countedQty: request.counted }),
            reason: clip(request.reason, REASON_MAX),
        })
    }

    /**
     * Applies a change at once when it is small (a few units, or little money); a bigger one is not applied: it becomes an
     * adjust_stock decision the owner approves. A counted level sets the quantity instead of adding to it.
     */
    async adjust(workspaceId: string, actor: string, input: AdjustInput): Promise<AdjustStockOutput> {
        const [row] = await this.entityManager.query<Array<ItemRowColumns>>(SELECT_ITEM, [workspaceId, input.itemId])
        if (row === undefined) throw new InventoryError({ code: InventoryErrorCode.ItemNotFound })
        const item = toInventoryItem(row)
        const locationId = input.locationId ?? (await this.locations.defaultLocation(workspaceId))
        const current = await this.movements.levelAt(item.id, locationId)
        const counting = input.countedQty !== undefined
        const delta = input.countedQty === undefined ? (input.delta ?? 0) : input.countedQty - current
        if (delta === 0) return { state: "applied", before: current, after: current }
        const reason =
            input.reason.trim() || this.text(counting ? "inventory.countReason" : "inventory.manualReason", {})
        if (isSmallAdjustment(delta, item.costVnd)) {
            const applied = await this.movements.apply(workspaceId, {
                itemId: item.id,
                locationId,
                kind: "adjust",
                delta,
                reason,
                refType: input.refType ?? "manual",
                by: actor,
                evidence: input.evidence ?? null,
            })
            await this.office.logEvidence(workspaceId, {
                kind: "inventory.adjust",
                actor,
                summary: this.text("inventory.adjustSummary", {
                    name: item.name,
                    before: formatQty(applied.before),
                    after: formatQty(applied.after),
                    unit: item.unit,
                    reason,
                }),
                evidence: input.evidence ?? null,
            })
            await this.movements.replenishLater(workspaceId, [item.id])
            return { state: "applied", before: applied.before, after: applied.after }
        }
        const value = Math.abs(delta) * item.costVnd
        const verdict = await this.gate.request({
            workspaceId,
            actor,
            action: "adjust_stock",
            subjectType: "stock",
            subjectId: item.id,
            dedupeKey: `adjust_stock:${item.id}:${this.clock.now().getTime()}`,
            summary: this.text("inventory.adjustAskSummary", {
                name: item.name,
                from: formatQty(current),
                to: formatQty(current + delta),
                unit: item.unit,
                change: `${delta > 0 ? "+" : ""}${formatQty(delta)}`,
                value: value > 0 ? this.text("inventory.adjustAskValue", { value: formatMoney(value) }) : "",
            }),
            amountVnd: Math.round(value),
            fields: {
                item_id: item.id,
                location_id: locationId,
                delta,
                reason,
                evidence: input.evidence ?? "",
                ref_type: input.refType ?? "manual",
                amount_vnd: Math.round(value),
            },
        })
        if (verdict.status === "done") {
            return { state: "applied", before: current, after: await this.movements.levelAt(item.id, locationId) }
        }
        return { state: "waiting", workItemId: verdict.workItemId }
    }

    /** Applies a stock count: every counted item that differs is adjusted (small ones now, big ones wait for approval). */
    async stockTake(userId: string, workspaceId: string, request: StockTakeParams): Promise<StockTakeOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, ANY_MEMBER)
        const counts = request.counts
            .filter((line) => Number.isFinite(line.counted) && line.counted >= 0)
            .slice(0, COUNT_LINES_MAX)
        if (counts.length === 0) throw new InventoryError({ code: InventoryErrorCode.CountEmpty })
        let applied = 0
        let waiting = 0
        let same = 0
        await eachInOrder(counts, async (line) => {
            const result = await this.adjust(workspaceId, actor, {
                itemId: line.itemId,
                countedQty: line.counted,
                reason: this.text("inventory.stockTakeReason", {}),
                refType: "count",
                evidence: this.text("inventory.stockTakeEvidence", {}),
            })
            if (result.state === "waiting") waiting += 1
            else if (result.before === result.after) same += 1
            else applied += 1
        })
        return { applied, waiting, same }
    }

    /** Moves goods between two locations: the total does not change, so no approval is needed; both sides are recorded. */
    async transferStock(
        userId: string,
        workspaceId: string,
        request: TransferStockParams,
    ): Promise<TransferStockOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, ANY_MEMBER)
        if (request.fromLocationId === request.toLocationId) {
            throw new InventoryError({ code: InventoryErrorCode.TransferSameLocation })
        }
        if (request.qty <= 0 || Number.isNaN(request.qty))
            throw new InventoryError({ code: InventoryErrorCode.TransferQtyRequired })
        const [item] = await this.entityManager.query<Array<ItemLabelRow>>(SELECT_ITEM_LABEL, [
            workspaceId,
            request.itemId,
        ])
        if (item === undefined) throw new InventoryError({ code: InventoryErrorCode.ItemNotFound })
        const places = await this.entityManager.query<Array<LocationNameRow>>(SELECT_LOCATION_NAMES, [
            workspaceId,
            [request.fromLocationId, request.toLocationId],
        ])
        const nameOf = new Map(places.map((place) => [place.id, place.name]))
        const fromName = nameOf.get(request.fromLocationId)
        const toName = nameOf.get(request.toLocationId)
        if (fromName === undefined || toName === undefined) {
            throw new InventoryError({ code: InventoryErrorCode.LocationNotFound })
        }
        const note = clip(request.note, NOTE_MAX)
        const reason = this.text("inventory.transferReason", {
            from: fromName,
            to: toName,
            note: note === "" ? "" : `: ${note}`,
        })
        const key = this.clock.now().getTime()
        const left = await this.movements.apply(workspaceId, {
            itemId: request.itemId,
            locationId: request.fromLocationId,
            kind: "transfer",
            delta: -request.qty,
            reason,
            refType: "transfer",
            by: actor,
            dedupe: `transfer:${key}:out:${request.itemId}`,
        })
        const arrived = await this.movements.apply(workspaceId, {
            itemId: request.itemId,
            locationId: request.toLocationId,
            kind: "transfer",
            delta: request.qty,
            reason,
            refType: "transfer",
            by: actor,
            dedupe: `transfer:${key}:in:${request.itemId}`,
        })
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.transfer",
            actor,
            summary: this.text("inventory.transferSummary", {
                name: item.name,
                reason,
                qty: formatQty(request.qty),
                unit: item.unit,
            }),
        })
        return { from: left.after, to: arrived.after }
    }

    /** The performer of the adjust_stock action: the approved quantity change becomes a movement. */
    async performAdjustStock(context: PerformContext): Promise<PerformResult> {
        const itemId = fieldText(context.fields, "item_id")
        const [item] = await this.entityManager.query<Array<ItemLabelRow>>(SELECT_ITEM_LABEL, [
            context.workspaceId,
            itemId,
        ])
        if (item === undefined) throw new InventoryError({ code: InventoryErrorCode.ItemNotFound })
        const reason = fieldText(context.fields, "reason") || this.text("inventory.adjustDefaultReason", {})
        const locationId = fieldText(context.fields, "location_id")
        const applied = await this.movements.apply(context.workspaceId, {
            itemId,
            ...(locationId === "" ? {} : { locationId }),
            kind: "adjust",
            delta: fieldNumber(context.fields, "delta"),
            reason,
            refType: fieldText(context.fields, "ref_type") === "count" ? "count" : "manual",
            by: context.actor,
            evidence: fieldText(context.fields, "evidence") || null,
            dedupe: `adjust:${context.workItemId}`,
        })
        await this.movements.replenishLater(context.workspaceId, [itemId])
        return {
            summary: this.text("inventory.performAdjustSummary", {
                name: item.name,
                before: formatQty(applied.before),
                after: formatQty(applied.after),
                unit: item.unit,
                reason,
            }),
            evidence: "captured",
            href: "/agents/inventory/workbench?tab=history",
        }
    }
}
