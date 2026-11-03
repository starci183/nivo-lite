import { CheckboxGroup } from "@starci/grammar/common"

/** A labelled group of checkboxes with the values ticked and the command that changes them. */
interface ShiftsCheckboxesProps {
    readonly label: string
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly value: ReadonlyArray<string>
    /** Absent while the commands are not there yet. */
    readonly onValueChange: ((value: Array<string>) => void) | undefined
    readonly isLoading: boolean | undefined
}

/** Draws a horizontal group of checkboxes of the shifts screens. */
export const ShiftsCheckboxes = (props: ShiftsCheckboxesProps) => (
    <CheckboxGroup
        label={props.label}
        orientation="horizontal"
        options={props.options}
        value={props.value}
        {...(props.onValueChange === undefined ? {} : { onValueChange: props.onValueChange })}
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
    />
)
