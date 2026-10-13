import { Select } from "@starci/grammar/common"

/** One option of a select. */
export interface InboxSelectOption {
    readonly id: string
    readonly label: string
}

/** What one select of the simulator needs. */
interface InboxSelectFieldProps {
    readonly name: string
    readonly label: string
    readonly options: ReadonlyArray<InboxSelectOption>
    readonly value: string
    readonly error: string | undefined
    readonly isPending: boolean
    readonly onChange: (value: string) => void
}

/** One select of the simulator: disabled while a send is pending, invalid with its message. */
export const InboxSelectField = (props: InboxSelectFieldProps) => (
    <Select
        variant="secondary"
        label={props.label}
        name={props.name}
        options={[...props.options]}
        value={props.value}
        isDisabled={props.isPending}
        isInvalid={props.error !== undefined}
        errorMessage={props.error}
        onValueChange={(value) => props.onChange(value ?? "")}
    />
)
