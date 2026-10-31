import { Meter } from "@starci/grammar/common"
import type { MeterSegments } from "@starci/grammar/common"

/** What the meter shows: the gates confirmed of all of them, with the words that read them. */
interface SetupMeterProps {
    readonly label: string
    /** "3/8". */
    readonly valueLabel: string
    readonly confirmed: number
    readonly total: number
    readonly size?: "sm"
    readonly isSkeleton?: boolean
}

const SEGMENTS: ReadonlyArray<MeterSegments> = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** One segment per gate when the count reads as a count (2 to 12 gates), else one continuous fill. */
const segmentsOf = (total: number): MeterSegments | undefined => SEGMENTS.find((count) => count === total)

/** The setup progress of an agent as a meter, cautionary until every gate is confirmed. */
export const SetupMeter = (props: SetupMeterProps) => {
    const segments = segmentsOf(props.total)
    return (
        <Meter
            label={props.label}
            valueLabel={props.valueLabel}
            value={props.confirmed}
            minValue={0}
            maxValue={props.total}
            tone={props.confirmed === props.total ? "affirmative" : "cautionary"}
            {...(props.size === undefined ? {} : { size: props.size })}
            {...(props.isSkeleton === undefined ? {} : { isSkeleton: props.isSkeleton })}
            {...(segments === undefined ? {} : { segments })}
        />
    )
}
