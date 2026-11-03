import { Section, PaneSection } from "@starci/grammar/common"
import type { Figure } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link SepayHealthBase}. */
export interface SepayHealthBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<ReadonlyArray<Figure>>
        readonly placeholder: ReadonlyArray<Figure>
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
            render={(items, isLoading) => (
                <Section kind="figures" ariaLabel={props.props.label} isLoading={isLoading} items={items} />
            )}
        />
    </PaneSection>
)
