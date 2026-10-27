import type { DescriptionListStatItem } from "@starci/grammar/common"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link SalesFiguresBase}. */
export interface SalesFiguresBaseProps {
    readonly props: {
        readonly label: string
        /** The four figures, one data slot: the read decides loading, failed or ready. */
        readonly slot: DataSlot<ReadonlyArray<DescriptionListStatItem>>
        /** The four terms with blank values: the skeleton draws the same strip as the ready one. */
        readonly placeholder: ReadonlyArray<DescriptionListStatItem>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the ribbon of the Sales workbench: open deals, the proposal value, won deals and the conversion. */
export const SalesFiguresBase = (props: SalesFiguresBaseProps) => {
    const { slot, placeholder, slotLabels, label } = props.props
    return (
        <SlotView slot={slot} placeholder={placeholder} labels={slotLabels} onRetry={props.on.retry}>
            {(items, isSkeleton) => <FiguresStrip label={label} items={items} isSkeleton={isSkeleton} />}
        </SlotView>
    )
}
