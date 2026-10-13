import { Input } from "@starci/grammar/common"

/** The words and state of one e-mail field. */
interface EmailFieldProps {
    readonly id: string
    readonly label: string
    readonly placeholder: string
    readonly value: string
    readonly error?: string
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
}

/** The e-mail input every auth form uses. */
export const EmailField = (props: EmailFieldProps) => (
    <Input
        id={props.id}
        name="email"
        kind="email"
        label={props.label}
        placeholder={props.placeholder}
        variant="secondary"
        isRequired
        isDisabled={props.isDisabled}
        value={props.value}
        isError={props.error !== undefined}
        errorMessage={props.error}
        onValueChange={props.onChange}
    />
)
