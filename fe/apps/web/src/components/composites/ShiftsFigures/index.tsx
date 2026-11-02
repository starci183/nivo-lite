import type { ShiftsWeekViews } from "@/modules/types"
type ShiftsFiguresProps = ShiftsWeekViews["figures"] & {
    readonly isLoading?: boolean
}
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { ShiftsFigureStrip } from "@/components/leaves/ShiftsFigureStrip"

/** Draws the four figures as a stat strip, or the staff pointer; nothing when the figures could not be read. */
export const ShiftsFigures = (props: ShiftsFiguresProps) => {
    if (props.staffNotice !== null) {
        return (
            <SurfaceCard
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                ariaLabel={props.ariaLabel}
            >
                <EmptyNotice message={props.staffNotice} />
            </SurfaceCard>
        )
    }
    return (
        <ShiftsFigureStrip
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            ariaLabel={props.ariaLabel}
            captions={props.captions}
            stats={props.stats}
        />
    )
}
