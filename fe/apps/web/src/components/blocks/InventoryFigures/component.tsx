import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"

/** The settled figures of the inventory ribbon. */
export interface InventoryFiguresBaseProps {
    readonly props: {
        readonly ariaLabel: string
        readonly isLoading: boolean
        readonly figures: ReadonlyArray<DescriptionListStatItem>
    }
}

/** Draws the four inventory figures as a stat strip. */
export const InventoryFiguresBase = (props: InventoryFiguresBaseProps) => (
    <SurfaceCard ariaLabel={props.props.ariaLabel}>
        <DescriptionList layout="stat-strip" isDivided isLoading={props.props.isLoading} items={props.props.figures} />
    </SurfaceCard>
)
