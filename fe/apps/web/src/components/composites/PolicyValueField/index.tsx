import { parseTime } from "@internationalized/date"
import { Grid, NumberField, Select, Switch, Textarea, TimeField } from "@starci/grammar/common"
import type { PolicyDrawerProps, PolicyDurationUnit, PolicyFormView } from "@/modules/types"

/** What the typed value control reads, and the one change it makes. */
interface PolicyValueFieldProps {
    readonly props: Pick<PolicyDrawerProps, "kind" | "form" | "per" | "isPending" | "copy">
    readonly on: { readonly patch: (change: Partial<PolicyFormView>) => void }
}

const UNITS: ReadonlyArray<PolicyDurationUnit> = ["minutes", "hours", "days"]

/** A time typed "8:00" or "08:00" as the control reads it; noon when it cannot be read. */
const timeOf = (text: string) => {
    try {
        return parseTime(text.padStart(5, "0"))
    } catch {
        return parseTime("12:00")
    }
}

/** A number the control produced; a cleared field is no value. */
const numberOf = (value: number): number | null => (Number.isNaN(value) ? null : value)

/** One number control of the value: its id, its display format, and the field of the form it writes. */
interface NumberValueProps extends PolicyValueFieldProps {
    readonly field: "amount" | "percent"
}

/** The display of each number value: the amount in dong (the per-unit words under it), or a percent. */
const NUMBER_FORMATS: Readonly<Record<NumberValueProps["field"], Intl.NumberFormatOptions>> = {
    amount: { style: "currency", currency: "VND", maximumFractionDigits: 0 },
    percent: { style: "unit", unit: "percent", maximumFractionDigits: 2 },
}

/** The control a value of money or a percent takes. */
const NumberValue = (props: NumberValueProps) => {
    const value = props.props.form[props.field]
    return (
        <NumberField
            id={`brain-policy-${props.field}`}
            label={props.props.copy.valueLabel}
            {...(props.field === "amount" && props.props.per !== null ? { description: props.props.per } : {})}
            minValue={0}
            hideSteppers
            formatOptions={NUMBER_FORMATS[props.field]}
            {...(value === null ? {} : { value })}
            isDisabled={props.props.isPending}
            onValueChange={(next) =>
                props.on.patch(props.field === "amount" ? { amount: numberOf(next) } : { percent: numberOf(next) })
            }
        />
    )
}

/** The control a value of money takes. */
const MoneyField = (props: PolicyValueFieldProps) => <NumberValue {...props} field="amount" />

/** The control a percent takes. */
const PercentField = (props: PolicyValueFieldProps) => <NumberValue {...props} field="percent" />

/** The control a duration takes: the amount and its unit side by side; the back end receives minutes. */
const DurationField = (props: PolicyValueFieldProps) => (
    <Grid kind="form" columns={2}>
        <NumberField
            id="brain-policy-duration"
            label={props.props.copy.valueLabel}
            minValue={0}
            hideSteppers
            {...(props.props.form.duration === null ? {} : { value: props.props.form.duration })}
            isDisabled={props.props.isPending}
            onValueChange={(duration) => props.on.patch({ duration: numberOf(duration) })}
        />
        <Select
            label={props.props.copy.durationUnit}
            options={props.props.copy.unitOptions}
            value={props.props.form.durationUnit}
            isDisabled={props.props.isPending}
            onValueChange={(value) => {
                const unit = UNITS.find((one) => one === value)
                if (unit !== undefined) props.on.patch({ durationUnit: unit })
            }}
        />
    </Grid>
)

/** The two ends of a time range. */
const ENDS = ["from", "to"] as const

/** The control a time range takes: its start and its end on the 24-hour clock. */
const TimeRangeField = (props: PolicyValueFieldProps) => (
    <Grid kind="form" columns={2}>
        {ENDS.map((end) => (
            <TimeField
                key={end}
                label={end === "from" ? props.props.copy.fromTime : props.props.copy.toTime}
                granularity="minute"
                hourCycle={24}
                value={timeOf(props.props.form[end])}
                isDisabled={props.props.isPending}
                onValueChange={(value) => {
                    if (value === null) return
                    const time = value.toString().slice(0, 5)
                    props.on.patch(end === "from" ? { from: time } : { to: time })
                }}
            />
        ))}
    </Grid>
)

/** The yes/no control: a switch whose description says the value it holds. */
const BooleanField = (props: PolicyValueFieldProps) => (
    <Switch
        label={props.props.copy.valueLabel}
        description={props.props.form.yes ? props.props.copy.yes : props.props.copy.no}
        isSelected={props.props.form.yes}
        isDisabled={props.props.isPending}
        onSelectedChange={(yes) => props.on.patch({ yes })}
    />
)

/** The words of a value that is no parameter. */
const TextField = (props: PolicyValueFieldProps) => (
    <Textarea
        id="brain-policy-text"
        name="value"
        label={props.props.copy.valueLabel}
        rows={2}
        isRequired
        value={props.props.form.text}
        isDisabled={props.props.isPending}
        onValueChange={(text) => props.on.patch({ text })}
    />
)

/** The control of each kind of value. */
const FIELDS = {
    money: MoneyField,
    percent: PercentField,
    duration: DurationField,
    time_range: TimeRangeField,
    boolean: BooleanField,
    text: TextField,
} as const

/** The typed control of a shop rule's value, inferred from the value itself: money, percent, duration, time range, yes/no, or text. */
export const PolicyValueField = (props: PolicyValueFieldProps) => {
    const Field = FIELDS[props.props.kind]
    return <Field props={props.props} on={props.on} />
}
