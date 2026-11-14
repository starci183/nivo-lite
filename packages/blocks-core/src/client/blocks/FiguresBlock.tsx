import type { ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { figuresBlock } from "../../blocks/figures.block"
import { cellContextOf } from "../../rows/cell-format"
import { chartPointOf, figureTextOf, isRibbon } from "../../rows/figure-format"
import { messageTextOf } from "../../rows/message-text"
import { textOf, valueAt } from "../../slots/paths"
import { useInCard } from "../composites/CardScope"
import { FiguresBars, FiguresProportion, FiguresStrip } from "../composites/FiguresStrip"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the frame of a chart is given. */
interface ChartFrameProps {
    readonly label: string
    readonly isLoading: boolean
    readonly children: ReactNode
}

/** A chart stands in a card of its own with its label as the heading, unless a card already holds it: nothing floats loose on the well. */
const ChartFrame = (props: ChartFrameProps): ReactNode =>
    useInCard() ? (
        props.children
    ) : (
        <SurfaceCard label={props.label} headingLevel={3} isLoading={props.isLoading}>
            {props.children}
        </SurfaceCard>
    )

/** A ribbon of figures over one bound record, as tiles, bars or gauges; while it loads the terms stay real and the values are blank. */
export const FiguresBlock = (props: RenderOf<typeof figuresBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.data
    const context = cellContextOf(host.locale(), props.props.currency)
    const kind = props.props.kind ?? "tiles"
    const ribbon = kind === "tiles" && isRibbon(props.props.variant, props.props.items.length)
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            {...(ribbon
                ? {
                      frame: (notice: ReactNode) => (
                          <SurfaceCard ariaLabel={words(props.props.label)}>{notice}</SurfaceCard>
                      ),
                  }
                : {})}
            render={(record, isLoading) => {
                const label = words(props.props.label)
                const caption = textOf(valueAt(record, props.props.captionPath))
                const points = props.props.items.map((item) => {
                    const raw = valueAt(record, item.path)
                    return chartPointOf(item.path, words(item.term), raw, figureTextOf(raw, item.format, context))
                })
                if (kind === "bars") {
                    return (
                        <ChartFrame label={label} isLoading={isLoading}>
                            <FiguresBars
                                label={label}
                                points={points}
                                empty={labels.empty}
                                isLoading={isLoading}
                                caption={caption}
                            />
                        </ChartFrame>
                    )
                }
                if (kind === "proportion") {
                    return (
                        <ChartFrame label={label} isLoading={isLoading}>
                            <FiguresProportion
                                points={points}
                                empty={labels.empty}
                                isLoading={isLoading}
                                caption={caption}
                            />
                        </ChartFrame>
                    )
                }
                return (
                    <FiguresStrip
                        label={label}
                        isRibbon={isRibbon(props.props.variant, points.length)}
                        isLoading={isLoading}
                        items={points.map((point, index) => {
                            const hint = messageTextOf(valueAt(record, props.props.items[index]?.hintPath), (key) =>
                                words({ key }),
                            )
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
