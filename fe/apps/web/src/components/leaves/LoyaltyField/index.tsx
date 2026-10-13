import { Input } from "@starci/grammar/common"

/** What one text field of a loyalty form draws and reports. */
type LoyaltyFieldProps = {
    readonly id: string
    readonly name?: string
    readonly label: string
    readonly value: string
    readonly hint?: string | undefined
    readonly placeholder?: string | undefined
    readonly error?: string | undefined
    readonly isRequired?: boolean
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
}

/** One text field of a loyalty member form: label, optional hint and placeholder, and the validation message when there is one. */
export const LoyaltyField = (props: LoyaltyFieldProps) => (
    <Input
        id={props.id}
        name={props.name ?? props.id}
        label={props.label}
        variant="secondary"
        value={props.value}
        isRequired={props.isRequired === true}
        isDisabled={props.isDisabled}
        {...(props.hint === undefined ? {} : { hint: props.hint })}
        {...(props.placeholder === undefined ? {} : { placeholder: props.placeholder })}
        {...(props.error === undefined ? {} : { isError: true, errorMessage: props.error })}
        onValueChange={props.onChange}
    />
)
