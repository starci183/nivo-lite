import type { DescriptionListStatItem } from "@starci/grammar/common"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { SlotView } from "@/components/composites/SlotView"
import type { SlotPanelProps } from "@/modules/types"

/** Props for {@link LeadGenFiguresBase}. */
export interface LeadGenFiguresBaseProps {
    /** The placeholder holds the four figures with zero values: the terms stay real, the values draw as skeleton lines. */
    readonly props: SlotPanelProps<ReadonlyArray<DescriptionListStatItem>> & { readonly label: string }
    readonly on: { readonly retry: () => void }
}

/** Draws the ribbon of the Lead Gen workbench: new today, hot and waiting, first reply and conversion. */
export const LeadGenFiguresBase = (props: LeadGenFiguresBaseProps) => {
    const { label, ...panel } = props.props
    return (
        <SlotView {...panel} onRetry={props.on.retry}>
            {(items, isSkeleton) => <FiguresStrip label={label} items={items} isSkeleton={isSkeleton} />}
        </SlotView>
    )
}
