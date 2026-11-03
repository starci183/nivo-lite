import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { figuresBlock } from "../../blocks/figures.block"
import { textOf, valueAt } from "../../slots/paths"
import { FiguresStrip } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A ribbon of figures over one bound record; while it loads the terms stay real and the values are blank. */
export const FiguresBlock = (props: RenderOf<typeof figuresBlock>): ReactNode => {
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
                <FiguresStrip
                    label={words(props.props.label)}
                    isLoading={isLoading}
                    items={props.props.items.map((item) => ({
                        id: item.path,
                        term: words(item.term),
                        value: textOf(valueAt(record, item.path)),
                    }))}
                />
            )}
        />
    )
}
