import type { DescriptionListStatItem } from "@starci/grammar/common"
import { FiguresRibbon } from "@/components/composites/FiguresRibbon"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link BookingFiguresBase}. */
export interface BookingFiguresBaseProps {
    readonly on: { readonly retry: () => void }
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<ReadonlyArray<DescriptionListStatItem>>
        readonly labels: SlotLabels
        /** The same figures with their values empty: the skeleton keeps the real terms. */
        readonly placeholder: ReadonlyArray<DescriptionListStatItem>
    }
}

/** Draws the figures strip of the booking workbench above its tabs. */
export const BookingFiguresBase = (props: BookingFiguresBaseProps) => (
    <SlotView {...props.props} forbidden="notice" onRetry={props.on.retry}>
        {(items, isSkeleton) => <FiguresRibbon label={props.props.label} items={items} isSkeleton={isSkeleton} />}
    </SlotView>
)
