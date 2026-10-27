import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"

/** What the ribbon of a workbench draws. */
type FiguresRibbonProps = {
    readonly label: string
    /** The stat items of the ribbon, already worded; the skeleton keeps the real terms with empty values. */
    readonly items: ReadonlyArray<DescriptionListStatItem>
    readonly isSkeleton: boolean
}

/** The ribbon of a workbench: its figures in one card. The block that owns the slot wraps it in SlotView. */
export const FiguresRibbon = (props: FiguresRibbonProps) => (
    <SurfaceCard ariaLabel={props.label}>
        <DescriptionList layout="stat-strip" isDivided isLoading={props.isSkeleton} items={props.items} />
    </SurfaceCard>
)
