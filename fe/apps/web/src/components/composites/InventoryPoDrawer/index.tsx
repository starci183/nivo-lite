import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryPoLine } from "@/components/branches/InventoryPoLine"
import { InventoryPoActions } from "@/components/leaves/InventoryPoActions"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Badge, Drawer, Text, Textarea } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, QUOTE_CLASS_NAME } from "./classNames"

/** One order line in an edit or receive form: what it is and the two typed numbers. */
type PoLineFormView = Readonly<Record<"id" | "name" | "hint" | "qty" | "cost", string>>
/** The words and state of the purchase order drawer. */
export interface InventoryPoDrawerProps {
    readonly props: {
        readonly say: InventorySay
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
/** One purchase order in a drawer: edit a draft, approve a waiting message, receive goods, read a finished order. */
export const InventoryPoDrawer = (props: InventoryPoDrawerProps) => {
    const { props: p, on } = props
    const say = p.say
    const editable = p.mode === "edit"
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.title}
            description={p.description}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                {editable ? (
                    <div className={FORM_GRID_CLASS_NAME}>
                        <InventorySelect
                            label={say("poSupplier")}
                            placeholder={say("poSupplierHint")}
                            value={p.supplierId}
                            options={p.suppliers}
                            onChange={(value) => on.supplier(value)}
                        />
                        <InventoryField
                            id="po-expected"
                            name="expected"
                            label={say("poExpected")}
                            hint={say("poExpectedHint")}
                            value={p.expected}
                            onChange={on.expected}
                        />
                    </div>
                ) : (
                    <Text size="sm" tone="muted">
                        {p.summary}
                    </Text>
                )}
                <Text weight="semibold">{say("poItems")}</Text>
                {p.mode === "read"
                    ? p.readLines.map((line) => (
                          <Text key={line.id} size="sm">
                              {line.text}
                          </Text>
                      ))
                    : null}
                {p.mode === "receive" ? (
                    <Text size="sm" tone="muted">
                        {say("poReceiveHint")}
                    </Text>
                ) : null}
                {p.mode === "read"
                    ? null
                    : p.lines.map((line, index) => (
                          <InventoryPoLine
                              key={line.id}
                              id={line.id}
                              name={line.name}
                              hint={line.hint}
                              qty={line.qty}
                              cost={line.cost}
                              qtyLabel={editable ? say("poQty") : say("poReceiveQty")}
                              costLabel={editable ? say("poUnitCost") : say("poReceiveCost")}
                              onQty={(value) => on.line(index, "qty", value)}
                              onCost={(value) => on.line(index, "cost", value)}
                          />
                      ))}
                {editable ? (
                    <Text size="sm" tone="muted">
                        {p.total}
                    </Text>
                ) : null}
                {p.mode === "receive" ? (
                    <InventoryField
                        id="rc-invoice"
                        name="invoice"
                        label={say("poInvoice")}
                        hint={say("poInvoiceHint")}
                        value={p.invoiceNo}
                        onChange={on.invoice}
                    />
                ) : null}
                {p.messageEditable ? (
                    <Textarea
                        variant="secondary"
                        label={p.messageTitle}
                        description={say("poMessageHint")}
                        rows={9}
                        value={p.message}
                        onValueChange={on.message}
                    />
                ) : null}
                {!p.messageEditable && p.message !== "" ? (
                    <div className={QUOTE_CLASS_NAME}>
                        <Text size="xs" tone="muted" weight="medium">
                            {say("poMessageDrafted")}
                        </Text>
                        <Text size="sm">{p.message}</Text>
                    </div>
                ) : null}
                {p.sendNote === null ? null : (
                    <Text size="sm" tone="muted">
                        {p.sendNote}
                    </Text>
                )}
                {p.sentByEmail ? <Badge tone="success">{say("poSentEmail")}</Badge> : null}
                <InventoryNotices error={p.error} notice={p.notice} />
                <InventoryPoActions
                    props={{
                        say,
                        supplierChosen: p.supplierId !== "",
                        canEdit: p.canEdit,
                        canApprove: p.canApprove,
                        canReceive: p.canReceive,
                        canCopy: p.canCopy,
                        canCancel: p.canCancel,
                        copied: p.copied,
                        isPending: p.isPending,
                    }}
                    on={{
                        sendForApproval: on.sendForApproval,
                        saveDraft: on.saveDraft,
                        approve: on.approve,
                        reject: on.reject,
                        receive: on.receive,
                        remind: on.remind,
                        copy: on.copy,
                        cancel: on.cancel,
                    }}
                />
            </div>
        </Drawer>
    )
}
