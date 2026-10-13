import { Input } from "@starci/grammar/common"

/** What one single-line text field of the simulator needs. */
interface InboxTextFieldProps {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly hint?: string
    readonly value: string
    readonly error: string | undefined
    readonly isPending: boolean
    readonly isRequired?: boolean
    readonly onChange: (value: string) => void
}

/** One single-line text field of the simulator: disabled while a send is pending, invalid with its message. */
export const InboxTextField = (props: InboxTextFieldProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        hint={props.hint}
        variant="secondary"
        isRequired={props.isRequired}
        isDisabled={props.isPending}
        value={props.value}
        isError={props.error !== undefined}
        errorMessage={props.error}
        onValueChange={props.onChange}
    />
)
