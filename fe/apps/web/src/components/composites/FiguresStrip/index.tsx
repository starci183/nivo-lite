import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"

/** Props for {@link FiguresStrip}. */
interface FiguresStripProps {
    readonly label: string
    /** The four stat items; while `isSkeleton`, their terms stay real and the values draw as skeleton lines. */
    readonly items: ReadonlyArray<DescriptionListStatItem>
    readonly isSkeleton: boolean
}

/** Draws the ribbon of a workbench (its four figures in one card); the status of the read is drawn by the block through SlotView. */
export const FiguresStrip = (props: FiguresStripProps) => (
    <SurfaceCard ariaLabel={props.label}>
        <DescriptionList layout="stat-strip" isDivided isLoading={props.isSkeleton} items={props.items} />
    </SurfaceCard>
)
