import { InventoryField } from "@/components/leaves/InventoryField"
import { InventorySelect } from "@/components/leaves/InventorySelect"

/** What the item choice and the quantity beside it need. */
interface InventoryPickProps {
    readonly selectLabel: string
    readonly selectHint: string
    readonly itemId: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly qtyId: string
    readonly qtyName: string
    readonly qtyLabel: string
    readonly qty: string
    readonly onPick: (itemId: string) => void
    readonly onQty: (value: string) => void
}

/** One item chosen from a list with the quantity typed beside it: the first two cells of an order or recipe line. */
export const InventoryPick = (props: InventoryPickProps) => (
    <>
        <InventorySelect
            label={props.selectLabel}
            placeholder={props.selectHint}
            value={props.itemId}
            options={props.options}
            onChange={props.onPick}
        />
        <InventoryField
            id={props.qtyId}
            name={props.qtyName}
            label={props.qtyLabel}
            value={props.qty}
            onChange={props.onQty}
        />
    </>
)
