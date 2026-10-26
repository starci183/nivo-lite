import { InventoryPoSupplierFields } from "@/components/branches/InventoryPoSupplierFields"
import type { InventoryPoDrawerProps } from "@/components/branches/InventoryPoSupplierFields"
export type { InventoryPoDrawerProps } from "@/components/branches/InventoryPoSupplierFields"

import { InventoryPoLine } from "@/components/branches/InventoryPoLine"
import { InventoryPoActions } from "@/components/leaves/InventoryPoActions"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Badge, Drawer, SurfaceCard, Text, Textarea } from "@starci/grammar/common"

import { FORM_CLASS_NAME, QUOTE_CLASS_NAME } from "./classNames"
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
                    <InventoryPoSupplierFields props={p} on={on} />
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
                    : p.lines.map((line, index) => renderInventoryPoDrawerLine(line, editable, say, on, index))}
                {editable ? (
                    <Text size="sm" tone="muted">
                        {p.total}
                    </Text>
                ) : null}
                {p.mode === "receive" ? renderInventoryPoDrawerInvoice(say, p, on) : null}
                {p.messageEditable ? (
                    <Textarea
                        label={p.messageTitle}
                        description={say("poMessageHint")}
                        rows={9}
                        value={p.message}
                        onValueChange={on.message}
                    />
                ) : null}
                {!p.messageEditable && p.message !== "" ? (
                    <SurfaceCard ariaLabel={say("poMessageDrafted")}>
                        <div className={QUOTE_CLASS_NAME}>
                            <Text size="xs" tone="muted" weight="medium">
                                {say("poMessageDrafted")}
                            </Text>
                            <Text size="sm">{p.message}</Text>
                        </div>
                    </SurfaceCard>
                ) : null}
                {p.sendNote === null ? null : (
                    <Text size="sm" tone="muted">
                        {p.sendNote}
                    </Text>
                )}
                {p.sentByEmail ? <Badge tone="success">{say("poSentEmail")}</Badge> : null}
                <InventoryNotices error={p.error} notice={p.notice} />
                {renderInventoryPoDrawerActions(p, on)}
            </div>
        </Drawer>
    )
}

/** Renders the InventoryPoDrawer actions section. */
const renderInventoryPoDrawerActions = (
    p: InventoryPoDrawerProps["props"],
    on: NonNullable<InventoryPoDrawerProps["on"]>,
) => (
    <InventoryPoActions
        props={{
            say: p.say,
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
)

/** Renders the InventoryPoDrawer line section. */
const renderInventoryPoDrawerLine = (
    line: Readonly<Record<"name" | "id" | "hint" | "qty" | "cost", string>>,
    editable: boolean,
    say: NonNullable<InventoryPoDrawerProps["props"]["say"]>,
    on: NonNullable<InventoryPoDrawerProps["on"]>,
    index: number,
) => (
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
)

/** Renders the InventoryPoDrawer invoice section. */
const renderInventoryPoDrawerInvoice = (
    say: NonNullable<InventoryPoDrawerProps["props"]["say"]>,
    p: InventoryPoDrawerProps["props"],
    on: NonNullable<InventoryPoDrawerProps["on"]>,
) => (
    <InventoryField
        id="rc-invoice"
        name="invoice"
        label={say("poInvoice")}
        hint={say("poInvoiceHint")}
        value={p.invoiceNo}
        onChange={on.invoice}
    />
)
