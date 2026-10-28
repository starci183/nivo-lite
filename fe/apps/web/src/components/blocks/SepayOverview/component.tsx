import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link SepayOverviewBase}. */
export interface SepayOverviewBaseProps {
    readonly props: {
        readonly title: string
        readonly slot: DataSlot<ReadonlyArray<DescriptionListItem>>
        readonly placeholder: ReadonlyArray<DescriptionListItem>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the short summary of a SePay connection. */
export const SepayOverviewBase = (props: SepayOverviewBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
        >
            {(items, isSkeleton) => <DescriptionList layout="columns" isLoading={isSkeleton} items={[...items]} />}
        </SlotView>
    </SurfaceCard>
)
