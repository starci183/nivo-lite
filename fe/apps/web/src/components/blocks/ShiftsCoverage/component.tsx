import { Meter, Region, SectionHeader, SurfaceCard } from "@starci/grammar/common"
import { DAYS_CLASS_NAME, METERS_CLASS_NAME, SECTION_CLASS_NAME } from "./classNames"

/** How a coverage block stands against its minimum and ideal. */
export type CoverageTone = "negative" | "cautionary" | "affirmative"

/** One coverage block of one day. */
interface CoverageMeterView {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly max: number
    readonly reading: string
    readonly tone: CoverageTone
}

/** One day of the week with its coverage blocks. */
interface CoverageDayView {
    readonly id: string
    readonly label: string
    readonly meters: ReadonlyArray<CoverageMeterView>
}

/** Copy and days the connected coverage block supplies. */
export interface ShiftsCoverageBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly days: ReadonlyArray<CoverageDayView>
    }
}

/** Draws one card per day with a meter per coverage block. */
export const ShiftsCoverageBase = (props: ShiftsCoverageBaseProps) => (
    <Region label={props.props.title}>
        <div className={SECTION_CLASS_NAME}>
            <SectionHeader level={2} title={props.props.title} description={props.props.hint} />
            <div className={DAYS_CLASS_NAME}>
                {props.props.days.map((day) => (
                    <SurfaceCard key={day.id} label={day.label} headingLevel={3}>
                        <div className={METERS_CLASS_NAME}>
                            {day.meters.map((meter) => (
                                <Meter
                                    key={meter.id}
                                    label={meter.label}
                                    value={meter.value}
                                    maxValue={meter.max}
                                    valueLabel={meter.reading}
                                    tone={meter.tone}
                                />
                            ))}
                        </div>
                    </SurfaceCard>
                ))}
            </div>
        </div>
    </Region>
)
