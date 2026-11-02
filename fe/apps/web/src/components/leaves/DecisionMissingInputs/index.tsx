import { Input } from "@starci/grammar/common"

/** A missing decision value, resolved by the owning proposal or question. */
interface DecisionMissingInput {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** The missing-input collection; its caller retains the original group and requirement policy. */
interface DecisionMissingInputsProps {
    readonly idPrefix: string
    readonly fields: ReadonlyArray<DecisionMissingInput>
    readonly isRequired?: boolean
    readonly isDisabled: boolean
    readonly isLoading?: boolean
    readonly onField: (name: string, value: string) => void
}

/** Gives named missing values their stable IDs and key-bound updates without adding a layout or fieldset. */
export const DecisionMissingInputs = (props: DecisionMissingInputsProps) => (
    <>
        {props.fields.map((field) => (
            <Input
                key={field.name}
                id={`${props.idPrefix}-${field.name}`}
                name={field.name}
                label={field.label}
                value={field.value}
                {...(props.isRequired === undefined ? {} : { isRequired: props.isRequired })}
                isDisabled={props.isDisabled}
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                onValueChange={(value) => props.onField(field.name, value)}
            />
        ))}
    </>
)
