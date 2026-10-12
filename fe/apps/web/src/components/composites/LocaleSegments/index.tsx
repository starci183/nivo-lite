import { SegmentedControl } from "@starci/grammar/common"

/** One language the switch offers: its code, short mark and spoken name. */
type LocaleSwitchOption = {
    readonly value: string
    readonly label: string
    readonly name: string
}

/** What the language switch draws and reports. */
type LocaleSwitchProps = {
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<LocaleSwitchOption>
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
}

/** The language switch: two joined segments, the chosen one carried by the grammar's selected state. */
export const LocaleSegments = (props: LocaleSwitchProps) => (
    <SegmentedControl
        label={props.label}
        isLabelHidden
        value={props.value}
        isDisabled={props.isDisabled}
        onValueChange={props.onChange}
        options={props.options.map((option) => ({
            value: option.value,
            label: option.label,
            accessibleLabel: option.name,
        }))}
    />
)
