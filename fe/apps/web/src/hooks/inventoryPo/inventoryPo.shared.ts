import type { PoView } from "@/modules/types"
import type { PoDrawerState, TypedLine } from "@/hooks/inventoryPoTypes"

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
export const withLine = (
    lines: ReadonlyArray<TypedLine>,
    index: number,
    field: "qty" | "cost",
    value: string,
): TypedLine[] => lines.map((line, at) => (at === index ? { ...line, [field]: value } : line))

/** What `draftInputOf` returns. */
export interface DraftInputOfResult {
    poId: string
    supplierId: string
    expectedAt: string
    lines: {
        lineId: string
        qty: string
        unitCost: string
    }[]
}

/** The request that saves the draft: supplier, date and the typed lines. */
export const draftInputOf = (open: PoDrawerState): DraftInputOfResult => ({
    poId: open.po.id,
    supplierId: open.supplierId,
    expectedAt: open.expected,
    lines: open.po.lines.map((line, index) => ({
        lineId: line.id,
        qty: open.lines[index]?.qty ?? "",
        unitCost: open.lines[index]?.cost ?? "",
    })),
})

/** What `receiveInputOf` returns. */
export interface ReceiveInputOfResult {
    poId: string
    invoiceNo: string
    note: string
    lines: {
        lineId: string
        qty: string
        unitCost: string
    }[]
}

/** The request that records the delivery: the typed received lines. */
export const receiveInputOf = (open: PoDrawerState): ReceiveInputOfResult => ({
    poId: open.po.id,
    invoiceNo: open.invoiceNo,
    note: "",
    lines: open.po.lines.map((line, index) => ({
        lineId: line.id,
        qty: open.received[index]?.qty ?? "",
        unitCost: open.received[index]?.cost ?? "",
    })),
})
