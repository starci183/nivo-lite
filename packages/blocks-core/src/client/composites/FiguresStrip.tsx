import type { ReactNode } from "react"
import { BarChart, EmptyNotice, Meter, Stack, SurfaceCard } from "@starci/grammar/common"
import type { Figure } from "@starci/grammar/common"
import { proportionTotal } from "../../rows/figure-format"
import type { ChartPoint } from "../../rows/figure-format"

/** Props for {@link FiguresStrip}. */
interface FiguresStripProps {
    readonly label: string
    /** The figure cells; while `isLoading`, their terms stay real and the values draw as skeleton lines. */
    readonly items: ReadonlyArray<Figure>
    readonly isLoading: boolean
}

/** Draws a ribbon of figures in one card; the status of the read is drawn by the block through SlotView. */
export const FiguresStrip = (props: FiguresStripProps): ReactNode => (
    <SurfaceCard kind="figures" ariaLabel={props.label} isLoading={props.isLoading} items={props.items} />
)

/** Props for the gauges of figures. */
interface FiguresProportionProps {
    /** The measured items; while `isLoading`, their labels stay real and the values draw as geometry. */
    readonly points: ReadonlyArray<ChartPoint>
    /** What draws when there is nothing to measure. */
    readonly empty: string
    readonly isLoading: boolean
}

/** Props for the bars of figures. */
interface FiguresBarsProps extends FiguresProportionProps {
    /** Names the chart for assistive technology. */
    readonly label: string
}

/** The items as bars on one scale from zero, each value over its bar and its label under it. */
export const FiguresBars = (props: FiguresBarsProps): ReactNode => (
    <BarChart
        label={props.label}
        bars={props.points.map((point) => ({
            id: point.id,
            label: point.label,
            value: point.value,
            valueLabel: point.valueLabel,
        }))}
        empty={<EmptyNotice message={props.empty} />}
        isLoading={props.isLoading}
    />
)

/** The items as one gauge each, all on the scale of their sum, so each reads as its share of the whole. */
export const FiguresProportion = (props: FiguresProportionProps): ReactNode => {
    if (!props.isLoading && props.points.length === 0) return <EmptyNotice message={props.empty} />
    const total = proportionTotal(props.points)
    return (
        <Stack gap="row">
            {props.points.map((point) => (
                <Meter
                    key={point.id}
                    label={point.label}
                    value={point.value}
                    minValue={0}
                    maxValue={total}
                    valueLabel={point.valueLabel}
                    isLoading={props.isLoading}
                />
            ))}
        </Stack>
    )
}
