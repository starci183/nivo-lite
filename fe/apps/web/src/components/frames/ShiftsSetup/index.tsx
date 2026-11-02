import { Stack } from "@starci/grammar/common"
import type { ShiftsSetupViews, ShiftsWorkbenchOn } from "@/modules/types"
import { ShiftsPositions } from "@/components/composites/ShiftsPositions"
import { ShiftsStaff } from "@/components/composites/ShiftsStaff"
import { ShiftsDemand } from "@/components/composites/ShiftsDemand"
import { ShiftsRules } from "@/components/composites/ShiftsRules"
import { ShiftsFormCard } from "@/components/composites/ShiftsFormCard"
type ShiftsSetupProps = ShiftsSetupViews["setupReady"] & {
    readonly copy: ShiftsSetupViews["setupCopy"]
    readonly on: ShiftsWorkbenchOn
    readonly isLoading: boolean
}
/** Keeps the recorded setup ready regions in their original order and spacing; status remains with the block. */
export const ShiftsSetup = (props: ShiftsSetupProps) =>
    props.isVisible ? (
        <Stack gap="section">
            {props.positions === undefined ? null : (
                <ShiftsPositions
                    {...props.copy.positions}
                    {...props.positions}
                    on={props.on.positions}
                    isLoading={props.isLoading}
                />
            )}
            {props.staff === undefined ? null : (
                <ShiftsStaff {...props.copy.staff} {...props.staff} on={props.on.staff} isLoading={props.isLoading} />
            )}
            {props.demand === undefined ? null : (
                <ShiftsDemand
                    {...props.copy.demand}
                    {...props.demand}
                    on={props.on.demand}
                    isLoading={props.isLoading}
                />
            )}
            {props.availability === undefined ? null : (
                <ShiftsFormCard
                    {...props.copy.availability}
                    {...props.availability}
                    isLoading={props.isLoading}
                    on={props.on.availability}
                />
            )}
            {props.rules === undefined ? null : (
                <ShiftsRules {...props.copy.rules} {...props.rules} on={props.on.rules} isLoading={props.isLoading} />
            )}
        </Stack>
    ) : null
