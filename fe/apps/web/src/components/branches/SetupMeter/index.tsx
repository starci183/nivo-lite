import { Meter } from "@starci/grammar/common"

/** What the meter shows: the gates confirmed of all of them, with the words that read them. */
interface SetupMeterProps {
    readonly label: string
    /** "3/8". */
    readonly valueLabel: string
    readonly confirmed: number
    readonly total: number
    readonly size?: "sm"
    readonly isLoading?: boolean
}

/** The setup progress of an agent as one continuous bar (the mockups draw one fill, not a segment per gate), cautionary until every gate is confirmed. */
export const SetupMeter = (props: SetupMeterProps) => {
    return (
        <Meter
            label={props.label}
            valueLabel={props.valueLabel}
            value={props.confirmed}
            minValue={0}
            maxValue={props.total}
            tone={props.confirmed === props.total ? "affirmative" : "cautionary"}
            {...(props.size === undefined ? {} : { size: props.size })}
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        />
    )
}
