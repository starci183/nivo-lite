import { Fieldset, Grid } from "@starci/grammar/common"
import { InventoryField } from "@/components/leaves/InventoryField"

/** What one order line of the drawer shows and edits. */
interface InventoryPoLineProps {
    readonly id: string
    readonly name: string
    readonly hint: string
    readonly qty: string
    readonly cost: string
    readonly qtyLabel: string
    readonly costLabel: string
    readonly onQty: (value: string) => void
    readonly onCost: (value: string) => void
}

/** One line of an order: the item with its hint, the quantity field and the price field. */
export const InventoryPoLine = (props: InventoryPoLineProps) => (
    <Fieldset legend={props.name} description={props.hint}>
        <Grid kind="form" columns={2}>
            <InventoryField
                id={`po-q-${props.id}`}
                name={`q-${props.id}`}
                label={props.qtyLabel}
                value={props.qty}
                onChange={props.onQty}
            />
            <InventoryField
                id={`po-c-${props.id}`}
                name={`c-${props.id}`}
                label={props.costLabel}
                value={props.cost}
                onChange={props.onCost}
            />
        </Grid>
    </Fieldset>
)
