import type { InventoryItemEditorData, InventoryItemFormData } from "@/modules/types"
import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer, Input, Stack, Grid, Cluster } from "@starci/grammar/common"

/** The words and state of the item drawer. */
interface InventoryItemDrawerProps {
    readonly props: InventoryItemEditorData
    readonly on: {
        readonly field: (name: keyof InventoryItemFormData, value: string) => void
        readonly save: () => void
        readonly toggleActive: () => void
        readonly close: () => void
    }
}

/** The form that adds or changes one catalogue item. */
export const InventoryItemDrawer = (props: InventoryItemDrawerProps) => {
    const { props: p, on } = props
    const copy = p.copy
    const text = (name: keyof InventoryItemFormData, id: string, label: string, hint?: string) => (
        <Input
            id={id}
            name={name}
            label={label}
            {...(hint === undefined ? {} : { hint })}
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
            title={p.editing === null ? copy.itemAddTitle : copy.itemEditTitle}
            description={copy.itemDrawerHint}
            closeLabel={copy.close}
            placement="right"
        >
            <Stack gap="row">
                {text("name", "inv-name", copy.itemName)}
                <Grid kind="form" columns={2}>
                    {text("sku", "inv-sku", copy.itemSku, copy.itemSkuHint)}
                    {text("unit", "inv-unit", copy.itemUnit, copy.itemUnitHint)}
                </Grid>
                {text("units", "inv-units", copy.itemUnits, copy.itemUnitsHint)}
                <Grid kind="form" columns={2}>
                    {text("category", "inv-cat", copy.itemCategory)}
                    <InventorySelect
                        label={copy.itemSupplier}
                        placeholder={copy.itemSupplierNone}
                        value={p.values.supplierId}
                        options={p.suppliers}
                        onChange={(value) => on.field("supplierId", value)}
                    />
                </Grid>
                <Grid kind="form" columns={2}>
                    {text("cost", "inv-cost", copy.itemCost)}
                    {text("sell", "inv-sell", copy.itemSell)}
                    {text("reorderPoint", "inv-rp", copy.itemReorderPoint, copy.itemReorderPointHint)}
                    {text("reorderQty", "inv-rq", copy.itemReorderQty)}
                </Grid>
                {text("aliases", "inv-alias", copy.itemAliases, copy.itemAliasesHint)}
                {p.editing === null ? text("openingQty", "inv-open", copy.itemOpening) : null}
                <InventoryNotices error={p.error} />
                <Cluster gap="inline">
                    <Button intent="commit" isPending={p.isPending} onPress={on.save}>
                        {copy.save}
                    </Button>
                    {p.active === null ? null : (
                        <Button intent="neutral" isDisabled={p.isPending} onPress={on.toggleActive}>
                            {p.active ? copy.itemStop : copy.itemResume}
                        </Button>
                    )}
                </Cluster>
            </Stack>
        </Drawer>
    )
}
