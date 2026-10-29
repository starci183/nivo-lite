import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeLog } from "@modules/domain/module-ops"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { ReceivePoOutput, ReceivePoParams } from "./inventory-operations.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { clip, uuidOrNull } from "./policies/input-text.policy"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { formatMoney, parseNumber } from "./policies/number-format.policy"
import { InstallationRecordsService } from "@modules/domain/module-installations"

/** Limits of the receive form. */
const INVOICE_MAX = 60
const NOTE_MAX = 300

/** The price difference that counts as a changed price. */
const PRICE_CHANGE_MIN = 1

interface OpenedReceiptRow {
    readonly inventory_open_receipt: string | null
}

/** Receipt facts used by the Office evidence and supplier price-change notice. */
interface ReceiptReport {
    readonly workspaceId: string
    readonly actor: string
    readonly poNo: string
    readonly complete: boolean
    readonly count: number
    readonly value: number
    readonly invoiceEvidence: string | null
    readonly priceChanges: ReadonlyArray<string>
}

@Injectable()
/** Receiving goods against a purchase order, in full or in part. */
export class InventoryReceivingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly movements: InventoryMovementsService,
        private readonly locations: InventoryLocationsService,
        private readonly orders: InventoryOrdersService,
        private readonly installations: InstallationRecordsService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /**
     * Receives goods against an order: each line's actual quantity becomes an `in` movement at the actual price, the
     * item cost moves to the weighted average and the order becomes partially received or received. A changed price is
     * listed and recorded; when Accounting is installed the supplier's invoice is handed over as a payable.
     */
    async receivePo(userId: string, workspaceId: string, request: ReceivePoParams): Promise<ReceivePoOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const po = await this.orders.loadPo(workspaceId, request.poId)
        if (po.status !== "sent" && po.status !== "partially_received") {
            throw new InventoryError({ code: InventoryErrorCode.PoNotReceivable })
        }
        const invoiceNo = clip(request.invoiceNo, INVOICE_MAX)
        const invoiceEvidence = invoiceNo === "" ? null : this.text("inventory.invoiceEvidence", { invoiceNo })
        const [receipt] = await callDbFunction<OpenedReceiptRow>(this.entityManager, "public.inventory_open_receipt", [
            workspaceId,
            po.id,
            invoiceNo || null,
            clip(request.note, NOTE_MAX),
            actor,
        ])
        const receiptId = receipt?.inventory_open_receipt
        if (receiptId === null || receiptId === undefined) {
            throw new InventoryError({ code: InventoryErrorCode.PoNotReceivable })
        }
        const locationId = await this.locations.defaultLocation(workspaceId)
        let value = 0
        const priceChanges: Array<string> = []
        const touched: Array<string> = []
        await eachInOrder(request.lines, async (entry) => {
            const qty = parseNumber(entry.qty)
            const line = po.lines.find((candidate) => candidate.id === entry.lineId)
            if (line === undefined || uuidOrNull(entry.lineId) === null || qty <= 0 || Number.isNaN(qty)) return
            const typedCost = entry.unitCost.trim() === "" ? -1 : Math.max(0, parseNumber(entry.unitCost))
            const cost = typedCost >= 0 ? typedCost : line.unitCost
            const applied = await this.movements.apply(workspaceId, {
                itemId: line.itemId,
                locationId,
                kind: "in",
                delta: qty,
                reason: this.text("inventory.receiveReason", { poNo: po.poNo }),
                refType: "po",
                refId: po.id,
                refLabel: po.poNo,
                by: actor,
                evidence: invoiceEvidence,
                dedupe: `po-receive:${receiptId}:${line.id}`,
                unitCost: cost,
            })
            if (!applied.applied) return
            value += qty * cost
            touched.push(line.itemId)
            await callDbFunction(this.entityManager, "public.inventory_receive_po_line", [line.id, qty, cost])
            if (Math.abs(cost - line.unitCost) >= PRICE_CHANGE_MIN) {
                priceChanges.push(
                    this.text("inventory.priceChange", {
                        name: line.itemName ?? this.text("inventory.itemFallback", {}),
                        from: formatMoney(line.unitCost),
                        to: formatMoney(cost),
                    }),
                )
            }
        })
        if (touched.length === 0) {
            await callDbFunction(this.entityManager, "public.inventory_discard_receipt", [receiptId])
            throw new InventoryError({ code: InventoryErrorCode.ReceiptEmpty })
        }
        await callDbFunction(this.entityManager, "public.inventory_close_receipt", [receiptId, Math.round(value)])
        const fresh = await this.orders.loadPo(workspaceId, po.id)
        const complete = fresh.lines.every((line) => line.qtyReceived >= line.qtyOrdered)
        const status = complete ? "received" : "partially_received"
        await callDbFunction(this.entityManager, "public.inventory_set_po_status", [po.id, status])
        await callDbFunction(this.entityManager, "public.inventory_recompute_po_total", [po.id])
        await this.reportReceipt({
            workspaceId,
            actor,
            poNo: po.poNo,
            complete,
            count: touched.length,
            value,
            invoiceEvidence,
            priceChanges,
        })
        const handedToAccounting = value > 0 && (await this.accountingInstalled(workspaceId))
        if (handedToAccounting)
            await this.handToAccounting(workspaceId, po.supplier?.name ?? null, po.poNo, invoiceNo, value)
        await this.movements.replenishLater(workspaceId, touched)
        return { status, received: touched.length, priceChanges, payableVnd: Math.round(value), handedToAccounting }
    }

    private async accountingInstalled(workspaceId: string): Promise<boolean> {
        return (await this.installations.firstOfModule(workspaceId, "accounting")) !== null
    }

    private async handToAccounting(
        workspaceId: string,
        supplier: string | null,
        poNo: string,
        invoiceNo: string,
        value: number,
    ): Promise<void> {
        const who = supplier ?? this.text("inventory.supplierFallback", {})
        const invoice = invoiceNo === "" ? "" : this.text("inventory.payableInvoice", { invoiceNo })
        await this.office.postOffice(
            workspaceId,
            this.text("inventory.payableNote", { who, value: formatMoney(value), invoice, poNo }),
        )
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.payable",
            actor: this.text("inventory.receiveActor", {}),
            summary: this.text("inventory.payableSummary", { who, value: formatMoney(value), poNo }),
            evidence: invoiceNo === "" ? null : this.text("inventory.invoiceEvidence", { invoiceNo }),
        })
    }

    private async reportReceipt({
        workspaceId,
        actor,
        poNo,
        complete,
        count,
        value,
        invoiceEvidence,
        priceChanges,
    }: ReceiptReport): Promise<void> {
        await this.office.logEvidence(workspaceId, {
            kind: "inventory.received",
            actor,
            summary: this.text(complete ? "inventory.receivedFullSummary" : "inventory.receivedPartSummary", {
                poNo,
                count,
                value: formatMoney(value),
            }),
            evidence:
                [
                    invoiceEvidence,
                    ...priceChanges.map((change) => this.text("inventory.priceChangeEvidence", { change })),
                ]
                    .filter(Boolean)
                    .join(" | ") || null,
        })
        if (priceChanges.length > 0) {
            await this.office.postOffice(
                workspaceId,
                this.text("inventory.priceChangeNote", { poNo, changes: priceChanges.join("; ") }),
            )
        }
    }
}
