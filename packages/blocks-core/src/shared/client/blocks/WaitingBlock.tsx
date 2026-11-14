import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { waitingBlock } from "../../blocks/waiting.block"
import { rowsSlot, parsedSlot } from "../../slots/slots"
import { ITEMS_REGION_PLACEHOLDER } from "../../views/placeholders"
import { itemsRegionView } from "../../views/views"
import { WaitingRegion } from "../composites/WaitingRegion"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The items that wait for a person; nothing waiting collapses the card, and a viewer without the right sees nothing. */
export const WaitingBlock = (props: RenderOf<typeof waitingBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.region
    return (
        <SlotView
            slot={rowsSlot(parsedSlot(read.slot, itemsRegionView))}
            labels={labels}
            placeholder={ITEMS_REGION_PLACEHOLDER}
            forbidden="hide"
            empty="collapse"
            onRetry={read.retry}
            render={(view, isLoading) => (
                <WaitingRegion
                    label={words(props.props.label)}
                    emptyMessage={labels.empty}
                    view={view}
                    isLoading={isLoading}
                />
            )}
        />
    )
}
