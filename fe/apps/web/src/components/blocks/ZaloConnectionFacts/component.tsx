import { PaneSection } from "@starci/grammar/common"
import { ConnectionFactsPane } from "@/components/frames/ConnectionFactsPane"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloFactView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const ZALO_FACTS_PLACEHOLDER: ReadonlyArray<ZaloFactView> = [
    { id: "one", label: "-", value: "-", meta: "-" },
    { id: "two", label: "-", value: "-", meta: "-" },
    { id: "three", label: "-", value: "-", meta: "-" },
]

/** Copy and slot of the health tiles. */
export interface ZaloConnectionFactsBaseProps {
    readonly props: {
        readonly label: string
        readonly facts: DataSlot<ReadonlyArray<ZaloFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the three health tiles of a Zalo OA connection (DISCIPLINE-2: figure, label, meta line) as a band of the page's main pane. */
export const ZaloConnectionFactsBase = (props: ZaloConnectionFactsBaseProps) => (
    <PaneSection>
        <SlotView
            slot={props.props.facts}
            placeholder={ZALO_FACTS_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(facts, isLoading) => (
                <ConnectionFactsPane label={props.props.label} facts={facts} isLoading={isLoading} />
            )}
        />
    </PaneSection>
)
