import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { figuresBlock } from "../../blocks/figures.block"
import { cellContextOf } from "../../rows/cell-format"
import { chartPointOf, figureTextOf } from "../../rows/figure-format"
import { textOf, valueAt } from "../../slots/paths"
import { FiguresBars, FiguresProportion, FiguresStrip } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A ribbon of figures over one bound record, as tiles, bars or gauges; while it loads the terms stay real and the values are blank. */
export const FiguresBlock = (props: RenderOf<typeof figuresBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.data
    const context = cellContextOf(host.locale(), props.props.currency)
    const kind = props.props.kind ?? "tiles"
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => {
                const label = words(props.props.label)
                const points = props.props.items.map((item) => {
                    const raw = valueAt(record, item.path)
                    return chartPointOf(item.path, words(item.term), raw, figureTextOf(raw, item.format, context))
                })
                if (kind === "bars") {
                    return <FiguresBars label={label} points={points} empty={labels.empty} isLoading={isLoading} />
                }
                if (kind === "proportion") {
                    return <FiguresProportion points={points} empty={labels.empty} isLoading={isLoading} />
                }
                return (
                    <FiguresStrip
                        label={label}
                        isLoading={isLoading}
                        items={points.map((point, index) => {
                            const hint = textOf(valueAt(record, props.props.items[index]?.hintPath))
                            return {
                                id: point.id,
                                term: point.label,
                                value: point.valueLabel,
                                ...(hint === "" ? {} : { meta: hint }),
                            }
                        })}
                    />
                )
            }}
        />
    )
}
