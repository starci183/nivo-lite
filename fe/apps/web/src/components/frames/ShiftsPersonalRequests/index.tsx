import { Stack } from "@starci/grammar/common"
import type { ShiftsPersonalViews, ShiftsWorkbenchOn } from "@/modules/types"
import { ShiftsMySwaps } from "@/components/composites/ShiftsMySwaps"
import { ShiftsFormCard } from "@/components/composites/ShiftsFormCard"
type ShiftsPersonalRequestsProps = ShiftsPersonalViews["personalReady"] & {
    readonly copy: ShiftsPersonalViews["personalCopy"]
    readonly on: ShiftsWorkbenchOn
    readonly isLoading: boolean
}
/** Keeps the recorded personal ready regions in their original order and spacing; status remains with the block. */
export const ShiftsPersonalRequests = (props: ShiftsPersonalRequestsProps) =>
    props.isVisible ? (
        <Stack gap="section">
            {props.leave === undefined ? null : (
                <ShiftsFormCard
                    {...props.copy.leave}
                    {...props.leave}
                    isLoading={props.isLoading}
                    on={props.on.leave}
                />
            )}
            {props.myAvailability === undefined ? null : (
                <ShiftsFormCard
                    {...props.copy.myAvailability}
                    {...props.myAvailability}
                    isLoading={props.isLoading}
                    on={props.on.myAvailability}
                />
            )}
            {props.mySwaps === undefined ? null : (
                <ShiftsMySwaps {...props.copy.mySwaps} {...props.mySwaps} isLoading={props.isLoading} />
            )}
        </Stack>
    ) : null
