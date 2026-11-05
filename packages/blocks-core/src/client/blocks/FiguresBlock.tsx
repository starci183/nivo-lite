import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { figuresBlock } from "../../blocks/figures.block"
import { cellContextOf } from "../../rows/cell-format"
import { figureTextOf } from "../../rows/figure-format"
import { valueAt } from "../../slots/paths"
import { FiguresStrip } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A ribbon of figures over one bound record; while it loads the terms stay real and the values are blank. */
export const FiguresBlock = (props: RenderOf<typeof figuresBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.data
    const context = cellContextOf(host.locale(), props.props.currency)
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
                        value: figureTextOf(valueAt(record, item.path), item.format, context),
                    }))}
                />
            )}
        />
    )
}
