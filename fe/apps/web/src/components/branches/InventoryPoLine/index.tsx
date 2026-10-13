import { Text } from "@starci/grammar/common"
import { InventoryField } from "@/components/leaves/InventoryField"
import { LINE_ROW_CLASS_NAME } from "./classNames"

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
    <div className={LINE_ROW_CLASS_NAME}>
        <div>
            <Text size="sm" weight="medium">
                {props.name}
            </Text>
            <Text size="xs" tone="muted">
                {props.hint}
            </Text>
        </div>
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
    </div>
)
