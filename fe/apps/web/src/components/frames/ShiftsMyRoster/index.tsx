import { Stack } from "@starci/grammar/common"
import type { ShiftsPersonalViews, ShiftsWorkbenchOn } from "@/modules/types"
import { ShiftsMyShifts } from "@/components/composites/ShiftsMyShifts"
import { ShiftsOpenShifts } from "@/components/composites/ShiftsOpenShifts"
type ShiftsMyRosterProps = ShiftsPersonalViews["rosterReady"] & {
    readonly copy: ShiftsPersonalViews["rosterCopy"]
    readonly on: ShiftsWorkbenchOn
    readonly isLoading: boolean
}
/** Keeps the recorded roster ready regions in their original order and spacing; status remains with the block. */
export const ShiftsMyRoster = (props: ShiftsMyRosterProps) =>
    props.isVisible ? (
        <Stack gap="section">
            {props.myShifts === undefined ? null : (
                <ShiftsMyShifts
                    {...props.copy.myShifts}
                    {...props.myShifts}
                    on={props.on.myShifts}
                    isLoading={props.isLoading}
                />
            )}
            {props.openShifts === undefined ? null : (
                <ShiftsOpenShifts
                    {...props.copy.openShifts}
                    {...props.openShifts}
                    on={props.on.openShifts}
                    isLoading={props.isLoading}
                />
            )}
        </Stack>
    ) : null
