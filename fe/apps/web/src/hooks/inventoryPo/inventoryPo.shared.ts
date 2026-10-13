import type { InventoryFormat } from "@/hooks/inventory"
import type { InventorySay, PoView, SupplierChannel, SupplierView } from "@/modules/types"

/** One typed line: a quantity and a unit cost. */
interface TypedLine {
    readonly qty: string
    readonly cost: string
}

/** The order drawer while it is open: the order and everything typed. */
export interface PoDrawerState {
    readonly po: PoView
    readonly supplierId: string
    readonly expected: string
    readonly lines: ReadonlyArray<TypedLine>
    readonly received: ReadonlyArray<TypedLine>
    readonly message: string
    readonly invoiceNo: string
    readonly copied: boolean
}

/** How the drawer shows the order: a draft is edited, an order on its way is received, the rest is read. */
type PoMode = "edit" | "receive" | "read"

/** What the drawer props need besides the state. */
export interface PoDrawerContext {
    readonly say: InventorySay
    readonly format: InventoryFormat
    readonly suppliers: ReadonlyArray<SupplierView>
    readonly canManage: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}

/** The money-free number reader the totals use: "1,5" and "1.5" both mean 1.5. */
const typedNumber = (text: string): number => {
    const parsed = Number(text.trim().replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
}

/** The drawer state of a freshly opened order. */
export const startPoState = (po: PoView): PoDrawerState => ({
    po,
    supplierId: po.supplierId ?? "",
    expected: po.expectedAt ?? "",
    lines: po.lines.map((line) => ({ qty: String(line.qtyOrdered), cost: String(line.unitCost) })),
    received: po.lines.map((line) => ({
        qty: String(Math.max(0, line.qtyOrdered - line.qtyReceived)),
        cost: String(line.unitCost),
    })),
    message: po.message,
    invoiceNo: "",
    copied: false,
})

/** The typed lines with one field of one line replaced. */
export const withLine = (lines: ReadonlyArray<TypedLine>, index: number, field: "qty" | "cost", value: string) =>
    lines.map((line, at) => (at === index ? { ...line, [field]: value } : line))

/** The facts of an order the drawer branches on. */
export const poFacts = (po: PoView) => {
    const editable = po.status === "draft"
    const receiving = po.status === "sent" || po.status === "partially_received"
    const lateMode: PoMode = receiving ? "receive" : "read"
    const mode: PoMode = editable ? "edit" : lateMode
    return { editable, receiving, waiting: po.status === "waiting_approval", mode }
}

/** The request that saves the draft: supplier, date and the typed lines. */
export const draftInputOf = (open: PoDrawerState) => ({
    poId: open.po.id,
    supplierId: open.supplierId,
    expectedAt: open.expected,
    lines: open.po.lines.map((line, index) => ({
        lineId: line.id,
        qty: open.lines[index]?.qty ?? "",
        unitCost: open.lines[index]?.cost ?? "",
    })),
})

/** The request that records the delivery: the typed received lines. */
export const receiveInputOf = (open: PoDrawerState) => ({
    poId: open.po.id,
    invoiceNo: open.invoiceNo,
    note: "",
    lines: open.po.lines.map((line, index) => ({
        lineId: line.id,
        qty: open.received[index]?.qty ?? "",
        unitCost: open.received[index]?.cost ?? "",
    })),
})

const channelKey = (channel: SupplierChannel | null): string => `channel_${channel ?? "email"}`

/** The props of the order drawer for the open order. */
export const poDrawerProps = (open: PoDrawerState, context: PoDrawerContext) => {
    const { say, format } = context
    const { po } = open
    const facts = poFacts(po)
    return {
        say,
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
