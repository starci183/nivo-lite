import type { InventoryNewPoEditorData } from "@/modules/types"
import { InventoryPick } from "@/components/branches/InventoryPick"
import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer, Stack, Grid } from "@starci/grammar/common"

/** The words and state of the new purchase order drawer. */
interface InventoryNewPoDrawerProps {
    readonly props: InventoryNewPoEditorData
    readonly on: {
        readonly supplier: (value: string) => void
        readonly pick: (index: number, itemId: string) => void
        readonly qty: (index: number, value: string) => void
        readonly cost: (index: number, value: string) => void
        readonly addLine: () => void
        readonly create: () => void
        readonly close: () => void
    }
}

/** The form that creates a purchase order by hand. */
export const InventoryNewPoDrawer = (props: InventoryNewPoDrawerProps) => {
    const { props: p, on } = props
    const copy = p.copy
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={copy.newPoTitle}
            description={copy.newPoHint}
            closeLabel={copy.close}
            placement="right"
        >
            <Stack gap="row">
                <InventorySelect
                    label={copy.poSupplier}
                    placeholder={copy.poSupplierHint}
                    value={p.supplierId}
                    options={p.suppliers}
                    onChange={(value) => on.supplier(value)}
                />
                {p.lines.map((line, index) => (
                    <Grid kind="form" columns={1} key={line.key}>
                        <InventoryPick
                            selectLabel={line.itemLabel}
                            selectHint={copy.newPoItemHint}
                            itemId={line.itemId}
                            options={p.items}
                            qtyId={`new-q-${line.key}`}
                            qtyName={`nq-${line.key}`}
                            qtyLabel={copy.poQty}
                            qty={line.qty}
                            onPick={(value) => on.pick(index, value)}
                            onQty={(value) => on.qty(index, value)}
                        />
                        <InventoryField
                            id={`new-c-${line.key}`}
                            name={`nc-${line.key}`}
                            label={copy.poUnitCost}
                            value={line.cost}
                            onChange={(value) => on.cost(index, value)}
                        />
                    </Grid>
                ))}
                <div>
                    <Button intent="neutral" size="sm" onPress={on.addLine}>
                        {copy.newPoAddLine}
                    </Button>
                </div>
                <InventoryNotices error={p.error} />
                <div>
                    <Button intent="commit" isPending={p.isPending} onPress={on.create}>
                        {copy.newPoCreate}
                    </Button>
                </div>
            </Stack>
        </Drawer>
    )
}
