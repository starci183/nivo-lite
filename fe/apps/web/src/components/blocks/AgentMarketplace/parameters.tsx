import { NumberField, Input, Select, Switch, Textarea } from "@starci/grammar/common"

/** One parameter of a listing the buyer fills in. */
export interface ParameterView {
    readonly key: string
    readonly label: string
    readonly value: string
    /** The type of the field: a number, one line of text, several lines, or a switch. */
    readonly kind: "number" | "text" | "toggle" | "textarea" | "time" | "choice"
    readonly hint: string
    readonly min: number | null
    readonly max: number | null
    /** What is wrong with the value, in words; empty while it is fine (or not yet asked for). */
    readonly error: string
    /** The choices of a `choice` field: the value kept and the label read. */
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** What one typed field of a listing draws. */
interface ParameterFieldProps {
    readonly parameter: ParameterView
    readonly isDisabled: boolean
    readonly onValue: (value: string) => void
}

/** The hint of a field, nothing when it has none. */
const hintOf = (parameter: ParameterView): string | undefined => (parameter.hint === "" ? undefined : parameter.hint)

/** The error of a field, nothing while it is fine. */
const errorOf = (parameter: ParameterView): string | undefined => (parameter.error === "" ? undefined : parameter.error)

/** A toggle parameter: a switch. */
const ToggleField = (props: ParameterFieldProps) => (
    <Switch
        name={props.parameter.key}
        label={props.parameter.label}
        description={hintOf(props.parameter) ?? props.parameter.label}
        isSelected={props.parameter.value === "true"}
        isDisabled={props.isDisabled}
        onSelectedChange={(on) => props.onValue(String(on))}
    />
)

/** A choice parameter: one of its options. */
const ChoiceField = (props: ParameterFieldProps) => (
    <Select
        label={props.parameter.label}
        description={hintOf(props.parameter)}
        options={[...props.parameter.options]}
        value={props.parameter.value === "" ? null : props.parameter.value}
        isInvalid={errorOf(props.parameter) !== undefined}
        errorMessage={errorOf(props.parameter)}
        isDisabled={props.isDisabled}
        onValueChange={(value) => props.onValue(value ?? "")}
    />
)

/** A number parameter: a number field with its bounds. */
const NumberParameterField = (props: ParameterFieldProps) => (
    <NumberField
        label={props.parameter.label}
        description={hintOf(props.parameter)}
        {...(props.parameter.min === null ? {} : { minValue: props.parameter.min })}
        {...(props.parameter.max === null ? {} : { maxValue: props.parameter.max })}
        {...(props.parameter.value === "" ? {} : { value: Number(props.parameter.value) })}
        isInvalid={errorOf(props.parameter) !== undefined}
        errorMessage={errorOf(props.parameter)}
        isDisabled={props.isDisabled}
        onValueChange={(value) => props.onValue(Number.isNaN(value) ? "" : String(value))}
    />
)

/** A text, textarea or time parameter: one line, a few lines, or one line with the time hint. */
const TextParameterField = (props: ParameterFieldProps) => {
    const Field = props.parameter.kind === "textarea" ? Textarea : Input
    return (
        <Field
            id={`param-${props.parameter.key}`}
            name={props.parameter.key}
            label={props.parameter.label}
            {...(props.parameter.kind === "time" ? { placeholder: "09:00" } : {})}
            description={hintOf(props.parameter)}
            value={props.parameter.value}
            isInvalid={errorOf(props.parameter) !== undefined}
            errorMessage={errorOf(props.parameter)}
            isDisabled={props.isDisabled}
            onValueChange={props.onValue}
        />
    )
}

/** One parameter as the field its type calls for; each says what is wrong in place. */
export const ParameterField = (props: ParameterFieldProps) => {
    switch (props.parameter.kind) {
        case "toggle":
            return <ToggleField {...props} />
        case "choice":
            return <ChoiceField {...props} />
        case "number":
            return <NumberParameterField {...props} />
        case "text":
        case "textarea":
        case "time":
            return <TextParameterField {...props} />
    }
}

