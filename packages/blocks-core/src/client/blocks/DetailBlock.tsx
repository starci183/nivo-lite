import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { DescriptionList, SurfaceCard } from "@starci/grammar/common"
import type { detailBlock } from "../../blocks/detail.block"
import { textOf, valueAt } from "../../slots/paths"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The facts of one bound record in a card. */
export const DetailBlock = (props: RenderOf<typeof detailBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.data
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <SurfaceCard label={words(props.props.label)} headingLevel={2} isLoading={isLoading}>
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={props.props.items.map((item) => ({
                            id: item.path,
                            term: words(item.term),
                            description: textOf(valueAt(record, item.path)),
                        }))}
                    />
                </SurfaceCard>
            )}
        />
    )
}
