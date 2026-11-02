import type { InventoryPoEditorData } from "@/modules/types"
import { Grid } from "@starci/grammar/common"
import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryField } from "@/components/leaves/InventoryField"

type PoLineFormView = Readonly<Record<"id" | "name" | "hint" | "qty" | "cost", string>>

/** The purchase order form, displayed state and bound commands of its drawer. */
export interface InventoryPoDrawerProps {
    readonly props: {
        readonly copy: InventoryPoEditorData["copy"]
        readonly title: string
        readonly description: string
        /** `edit` for a draft, `receive` for an order on its way, `read` for the rest. */
        readonly mode: "edit" | "receive" | "read"
        readonly summary: string
        readonly supplierId: string
        readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly expected: string
        readonly lines: ReadonlyArray<PoLineFormView>
        readonly readLines: ReadonlyArray<{ readonly id: string; readonly text: string }>
        readonly total: string
        readonly invoiceNo: string
        readonly messageTitle: string
        readonly message: string
        readonly messageEditable: boolean
        readonly sendNote: string | null
        readonly sentByEmail: boolean
        readonly canEdit: boolean
        readonly canApprove: boolean
        readonly canReceive: boolean
        readonly canCopy: boolean
        readonly canCancel: boolean
        readonly copied: boolean
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly supplier: (value: string) => void
        readonly expected: (value: string) => void
        readonly line: (index: number, field: "qty" | "cost", value: string) => void
        readonly invoice: (value: string) => void
        readonly message: (value: string) => void
        readonly saveDraft: () => void
        readonly sendForApproval: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly receive: () => void
        readonly remind: () => void
        readonly copy: () => void
        readonly cancel: () => void
        readonly close: () => void
    }
}

/** The supplier and expected delivery fields of a draft order. */
interface InventoryPoSupplierFieldsProps {
    readonly props: Pick<InventoryPoDrawerProps["props"], "copy" | "supplierId" | "suppliers" | "expected">
    readonly on: Pick<InventoryPoDrawerProps["on"], "supplier" | "expected">
}

/** Renders the supplier and delivery date of a draft purchase order. */
export const InventoryPoSupplierFields = (props: InventoryPoSupplierFieldsProps) => {
    const { props: p, on } = props
    const copy = p.copy
    return (
        <Grid kind="form" columns={2}>
            <InventorySelect
                label={copy.poSupplier}
                placeholder={copy.poSupplierHint}
                value={p.supplierId}
                options={p.suppliers}
                onChange={(value) => on.supplier(value)}
            />
            <InventoryField
                id="po-expected"
                name="expected"
                label={copy.poExpected}
                hint={copy.poExpectedHint}
                value={p.expected}
                onChange={on.expected}
            />
        </Grid>
    )
}
