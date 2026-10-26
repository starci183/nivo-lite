import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import type { SupplierFormValues, SupplierFormField } from "@/hooks/inventory"
import { Button, Drawer, Input, SegmentedControl, Textarea } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { FORM_CLASS_NAME, FORM_GRID_CLASS_NAME } from "./classNames"

/** The words and state of the supplier drawer. */
export interface InventorySupplierDrawerProps {
    readonly props: {
        readonly say: InventorySay
        /** The name of the supplier being changed, or null when a new one is added. */
        readonly editing: string | null
        readonly values: SupplierFormValues
        readonly channels: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly isPending: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly field: (name: SupplierFormField, value: string) => void
        readonly save: () => void
        readonly close: () => void
    }
}

/** The form that adds or changes one supplier. */
export const InventorySupplierDrawer = (props: InventorySupplierDrawerProps) => {
    const { props: p, on } = props
    const say = p.say
    const text = (name: SupplierFormField, id: string, label: string, kind?: "email") => (
        <Input
            id={id}
            name={name}
            label={label}
            {...(kind === undefined ? {} : { kind })}
            value={p.values[name]}
            onValueChange={(value) => on.field(name, value)}
        />
    )
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.editing === null ? say("supplierAddTitle") : say("supplierEditTitle", { name: p.editing })}
            description={say("supplierDrawerHint")}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                {text("name", "sup-name", say("supplierName"))}
                {text("contactName", "sup-contact", say("supplierContact"))}
                <SegmentedControl
                    label={say("supplierChannel")}
                    options={p.channels}
                    value={p.values.channel}
                    onValueChange={(value) => on.field("channel", value)}
                />
                <div className={FORM_GRID_CLASS_NAME}>
                    {text("email", "sup-email", say("supplierEmail"), "email")}
                    {text("phone", "sup-phone", say("supplierPhone"))}
                    {text("zalo", "sup-zalo", say("supplierZalo"))}
                    {text("leadTime", "sup-lead", say("supplierLead"))}
                </div>
                {text("terms", "sup-terms", say("supplierTerms"))}
                <Textarea
                    label={say("supplierNote")}
                    rows={2}
                    value={p.values.note}
                    onValueChange={(value) => on.field("note", value)}
                />
                <InventoryNotices error={p.error} />
                <div>
                    <Button intent="commit" isPending={p.isPending} onPress={on.save}>
                        {say("save")}
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}
