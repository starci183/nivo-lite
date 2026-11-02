import { Stack } from "@starci/grammar/common"
import type { ShiftsWeekViews, ShiftsWorkbenchOn } from "@/modules/types"
import { ShiftsWeekBar } from "@/components/composites/ShiftsWeekBar"
import { ShiftsWeekStats } from "@/components/composites/ShiftsWeekStats"
import { ShiftsCoverage } from "@/components/composites/ShiftsCoverage"
import { ShiftsGrid } from "@/components/composites/ShiftsGrid"
type ShiftsWeekProps = ShiftsWeekViews["weekReady"] & {
    readonly copy: ShiftsWeekViews["weekCopy"]
    readonly on: ShiftsWorkbenchOn
    readonly isLoading: boolean
}
/** Keeps the recorded week ready regions in their original order and spacing; status remains with the block. */
export const ShiftsWeek = (props: ShiftsWeekProps) =>
    props.isVisible ? (
        <Stack gap="section">
            {props.weekBar === undefined ? null : (
                <ShiftsWeekBar
                    {...props.copy.weekBar}
                    {...props.weekBar}
                    on={props.on.weekBar}
                    isLoading={props.isLoading}
                />
            )}
            {props.weekStats === undefined ? null : (
                <ShiftsWeekStats {...props.copy.weekStats} {...props.weekStats} isLoading={props.isLoading} />
            )}
            {props.coverage === undefined ? null : (
                <ShiftsCoverage {...props.copy.coverage} {...props.coverage} isLoading={props.isLoading} />
            )}
            {props.grid === undefined ? null : (
                <ShiftsGrid {...props.copy.grid} {...props.grid} on={props.on.grid} isLoading={props.isLoading} />
            )}
        </Stack>
    ) : null
