import type { InventoryFormat } from "@/hooks/inventory"
import type { InventorySay, PoView, SupplierView } from "@/modules/types"

/** The view `usePoCopy` returns. */
export interface PoCopyView {
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

/** One typed line: a quantity and a unit cost. */
export interface TypedLine {
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
export type PoMode = "edit" | "receive" | "read"

/** What the drawer props need besides the state. */
export interface PoDrawerContext {
    readonly copy: PoCopyView
    readonly say: InventorySay
    readonly format: InventoryFormat
    readonly suppliers: ReadonlyArray<SupplierView>
    readonly canManage: boolean
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}

/** The commands the order drawer answers. */
export interface PoDrawerOn {
    supplier: (supplierId: string) => void
    expected: (expected: string) => void
    line: (index: number, field: "qty" | "cost", value: string) => void
    invoice: (invoiceNo: string) => void
    message: (message: string) => void
    saveDraft: () => void
    sendForApproval: () => void
    approve: () => void
    reject: () => void
    receive: () => void
    remind: () => void
    copy: () => void
    cancel: () => void
    close: () => void
}
