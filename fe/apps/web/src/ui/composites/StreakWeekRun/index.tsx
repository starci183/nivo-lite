import { DayCell, type DayCellData } from "../../leaves/DayCell"

/** Resolved seven-day streak data. */
export type StreakWeekRunData = { readonly days?: ReadonlyArray<DayCellData> }
/** Props for the week run. */
export type StreakWeekRunProps = { readonly props: StreakWeekRunData; readonly isLoading?: boolean }

const RESTING_WEEK: ReadonlyArray<DayCellData> = Array.from({ length: 7 }, (_unused, index) => ({ id: `resting-${index}` }))

/** Render the seven independent days of a week. */
export const StreakWeekRun = (props: StreakWeekRunProps) => (
    <div>
        {(props.isLoading ? RESTING_WEEK : props.props.days ?? RESTING_WEEK).map((day) => <DayCell key={day.id} props={day} isLoading={props.isLoading} />)}
    </div>
)