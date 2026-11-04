import type { PoDrawerContext, PoDrawerState, PoMode } from "@/hooks/inventoryPoTypes"
import type { PoView, SupplierChannel } from "@/modules/types"

/** The money-free number reader the totals use: "1,5" and "1.5" both mean 1.5. */
const typedNumber = (text: string): number => {
    const parsed = Number(text.trim().replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
}

/** What `poFacts` returns. */
interface PoFactsResult {
    editable: boolean
    receiving: boolean
    waiting: boolean
    mode: PoMode
}

/** The facts of an order the drawer branches on. */
const poFacts = (po: PoView): PoFactsResult => {
    const editable = po.status === "draft"
    const receiving = po.status === "sent" || po.status === "partially_received"
    const lateMode: PoMode = receiving ? "receive" : "read"
    const mode: PoMode = editable ? "edit" : lateMode
    return { editable, receiving, waiting: po.status === "waiting_approval", mode }
}

const channelKey = (channel: SupplierChannel | null): string => `channel_${channel ?? "email"}`

/** What `poDrawerProps` returns. */
export interface PoDrawerPropsResult {
    copy: {
        readonly approveAndSend: string
        readonly close: string
        readonly poCancel: string
        readonly poCopied: string
        readonly poCopy: string
        readonly poExpected: string
        readonly poExpectedHint: string
        readonly poInvoice: string
        readonly poInvoiceHint: string
        readonly poItems: string
        readonly poMessageDrafted: string
        readonly poMessageHint: string
        readonly poQty: string
        readonly poReceive: string
        readonly poReceiveCost: string
        readonly poReceiveHint: string
        readonly poReceiveQty: string
        readonly poRemind: string
        readonly poSaveDraft: string
        readonly poSendForApproval: string
        readonly poSentEmail: string
        readonly poSupplier: string
        readonly poSupplierHint: string
        readonly poUnitCost: string
        readonly reject: string
    }
    title: string
    description: string
    mode: PoMode
    summary: string
    supplierId: string
    suppliers: {
        id: string
        label: string
    }[]
    expected: string
    lines: {
        id: string
        name: string
        hint: string
        qty: string
        cost: string
    }[]
    readLines: {
        id: string
        text: string
    }[]
    total: string
    invoiceNo: string
    messageTitle: string
    message: string
    messageEditable: boolean
    sendNote: string | null
    sentByEmail: boolean
    canEdit: boolean
    canApprove: boolean
    canReceive: boolean
    canCopy: boolean
    canCancel: boolean
    copied: boolean
    isPending: boolean
    error: string | null
    notice: string | null
}

/** The props of the order drawer for the open order. */
export const poDrawerProps = (open: PoDrawerState, context: PoDrawerContext): PoDrawerPropsResult => {
    const { say, format } = context
    const { po } = open
    const facts = poFacts(po)
    return {
        copy: context.copy,
        title: say("poTitle", { no: po.poNo }),
        description: say("poDescription", {
            supplier: po.supplierName === "" ? say("poNoSupplier") : po.supplierName,
            status: say(`po_${po.status}`),
            source: po.source === "auto" ? say("poAuto") : "",
        }),
        mode: facts.mode,
        summary: say("poSummary", {
            date: format.day(po.expectedAt),
            total: format.money(po.totalVnd),
            reminders: po.reminders > 0 ? say("poReminders", { n: po.reminders }) : "",
        }),
        supplierId: open.supplierId,
        suppliers: context.suppliers.map((supplier) => ({ id: supplier.id, label: supplier.name })),
        expected: open.expected,
        lines: po.lines.map((line, index) => {
            const typed = facts.editable ? open.lines[index] : open.received[index]
            return {
                id: line.id,
                name: facts.editable ? `${line.name} (${line.unit})` : line.name,
                hint: facts.editable
                    ? ""
                    : say("poLineHint", {
                          ordered: format.qty(line.qtyOrdered),
                          received: format.qty(line.qtyReceived),
                          unit: line.unit,
                      }),
                qty: typed?.qty ?? "",
                cost: typed?.cost ?? "",
            }
        }),
        readLines: po.lines.map((line) => ({
            id: line.id,
            text: say("poReadLine", {
                name: line.name,
                ordered: format.qty(line.qtyOrdered),
                received: format.qty(line.qtyReceived),
                unit: line.unit,
                cost: format.money(line.unitCost),
            }),
        })),
        total: say("poTotal", {
            total: format.money(
                open.lines.reduce((sum, line) => sum + typedNumber(line.qty) * typedNumber(line.cost), 0),
            ),
        }),
        invoiceNo: open.invoiceNo,
        messageTitle: say("poMessageTitle", { supplier: po.supplierName, channel: say(channelKey(po.channel)) }),
        message: facts.waiting ? open.message : po.message,
        messageEditable: facts.waiting,
        sendNote: po.sendNote,
        sentByEmail: po.sentVia === "email",
        canEdit: facts.editable && context.canManage,
        canApprove: facts.waiting && po.workItemId !== null,
        canReceive: facts.receiving && context.canManage,
        canCopy: po.message !== "" && (facts.receiving || facts.waiting),
        canCancel: context.canManage && (facts.editable || facts.waiting || po.status === "sent"),
        copied: open.copied,
        isPending: context.isPending,
        error: context.error,
        notice: context.notice,
    }
}
