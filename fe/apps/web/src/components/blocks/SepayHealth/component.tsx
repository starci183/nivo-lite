import { DescriptionList, PaneSection } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link SepayHealthBase}. */
export interface SepayHealthBaseProps {
    readonly props: {
        readonly slot: DataSlot<ReadonlyArray<DescriptionListStatItem>>
        readonly placeholder: ReadonlyArray<DescriptionListStatItem>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the three health tiles as a band of the main pane: last webhook, valid keys in 24 hours, duplicates blocked. */
export const SepayHealthBase = (props: SepayHealthBaseProps) => (
    <PaneSection>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
        >
            {(items, isSkeleton) => (
                <DescriptionList layout="stat-strip" isDivided isLoading={isSkeleton} items={[...items]} />
            )}
        </SlotView>
    </PaneSection>
)
