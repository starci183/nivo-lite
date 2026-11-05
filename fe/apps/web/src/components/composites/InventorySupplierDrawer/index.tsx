import type { InventorySupplierEditorData, SupplierFormField } from "@/modules/types"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, ChoiceChips, Drawer, Input, Textarea, Stack, Grid } from "@starci/grammar/common"

/** The words and state of the supplier drawer. */
interface InventorySupplierDrawerProps {
    readonly props: InventorySupplierEditorData
    readonly on: {
        readonly field: (name: SupplierFormField, value: string) => void
        readonly save: () => void
        readonly close: () => void
    }
}

/** The form that adds or changes one supplier. */
export const InventorySupplierDrawer = (props: InventorySupplierDrawerProps) => {
    const { props: p, on } = props
    const copy = p.copy
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
            title={p.editing === null ? copy.supplierAddTitle : copy.supplierEditTitle}
            description={copy.supplierDrawerHint}
            closeLabel={copy.close}
            placement="right"
        >
            <Stack gap="row">
                {text("name", "sup-name", copy.supplierName)}
                {text("contactName", "sup-contact", copy.supplierContact)}
                <ChoiceChips
                    label={copy.supplierChannel}
                    empty={copy.supplierChannel}
                    options={p.channels}
                    value={p.values.channel}
                    onValueChange={(value) => on.field("channel", value)}
                />
                <Grid kind="form" columns={2}>
                    {text("email", "sup-email", copy.supplierEmail, "email")}
                    {text("phone", "sup-phone", copy.supplierPhone)}
                    {text("zalo", "sup-zalo", copy.supplierZalo)}
                    {text("leadTime", "sup-lead", copy.supplierLead)}
                </Grid>
                {text("terms", "sup-terms", copy.supplierTerms)}
                <Textarea
                    label={copy.supplierNote}
                    rows={2}
                    value={p.values.note}
                    onValueChange={(value) => on.field("note", value)}
                />
                <InventoryNotices error={p.error} />
                <div>
                    <Button intent="commit" isPending={p.isPending} onPress={on.save}>
                        {copy.save}
                    </Button>
                </div>
            </Stack>
        </Drawer>
    )
}
