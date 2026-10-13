import { DescriptionList, EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** One figure of the strip. */
interface FigureView {
    readonly id: string
    readonly term: string
    readonly value: string
    /** The unit shown after the value, or empty. */
    readonly unit: string
    readonly meta: string
}

/** Copy and figures the connected strip supplies. */
export interface ShiftsFiguresBaseProps {
    readonly props: {
        readonly ariaLabel: string
        /** Set for staff: the strip is replaced by this pointer to their own schedule. */
        readonly staffNotice: string | null
        readonly stats: ReadonlyArray<FigureView>
    }
}

/** Draws the four figures as a stat strip, or the staff pointer; nothing when the figures could not be read. */
export const ShiftsFiguresBase = (props: ShiftsFiguresBaseProps) => {
    if (props.props.staffNotice !== null) {
        return (
            <SurfaceCard ariaLabel={props.props.ariaLabel}>
                <EmptyNotice message={props.props.staffNotice} />
            </SurfaceCard>
        )
    }
    if (props.props.stats.length === 0) return null
    return (
        <SurfaceCard ariaLabel={props.props.ariaLabel}>
            <DescriptionList
                layout="stat-strip"
                isDivided
                items={props.props.stats.map((stat) => ({
                    id: stat.id,
                    term: stat.term,
                    description: stat.value,
                    unit: stat.unit === "" ? undefined : stat.unit,
                    meta: stat.meta,
                }))}
            />
        </SurfaceCard>
    )
}
