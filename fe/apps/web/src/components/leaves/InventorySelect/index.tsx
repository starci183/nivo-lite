import { Select } from "@starci/grammar/common"

/** What one choice field of the inventory forms needs. */
interface InventorySelectProps {
    readonly label: string
    readonly placeholder?: string
    /** The chosen id, or an empty text for none. */
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onChange: (value: string) => void
}

/** A choice field in the secondary form variant: an empty value shows the placeholder, a change answers an id or an empty text. */
export const InventorySelect = (props: InventorySelectProps) => (
    <Select
        label={props.label}
        {...(props.placeholder === undefined ? {} : { placeholder: props.placeholder })}
        value={props.value === "" ? null : props.value}
        options={props.options}
        onValueChange={(value) => props.onChange(value ?? "")}
    />
)
