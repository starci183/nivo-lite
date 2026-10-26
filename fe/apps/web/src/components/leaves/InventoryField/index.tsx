import { Input } from "@starci/grammar/common"

/** What one labelled text field of the inventory forms needs. */
interface InventoryFieldProps {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly value: string
    readonly hint?: string
    readonly onChange: (value: string) => void
}

/** A labelled text field with an optional hint. */
export const InventoryField = (props: InventoryFieldProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        {...(props.hint === undefined ? {} : { hint: props.hint })}
        value={props.value}
        onValueChange={props.onChange}
    />
)
