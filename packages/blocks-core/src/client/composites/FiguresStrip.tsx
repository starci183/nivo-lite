import type { ReactNode } from "react"
import { BarChart, EmptyNotice, Meter, Section, Stack, SurfaceCard, Text, type Figure } from "@starci/grammar/common"
import { proportionTotal, type ChartPoint } from "../../rows/figure-format"
import { useInCard } from "./CardScope"

/** Props for {@link FiguresStrip}. */
interface FiguresStripProps {
    /** Draw the figures as one surface with dividers between them, not bare under the heading. */
    readonly isRibbon: boolean
    readonly label: string
    /** The figure cells; while `isLoading`, their terms stay real and the values draw as skeleton lines. */
    readonly items: ReadonlyArray<Figure>
    readonly isLoading: boolean
}

/**
 * Draws a ribbon of figures as one card with its label as the heading (inside a card that already names it, the label only names the
 * strip), or the figures bare, named for assistive technology only; the status of the read is drawn by the block through SlotView.
 */
export const FiguresStrip = (props: FiguresStripProps): ReactNode => {
    const inCard = useInCard()
    const head = inCard ? { ariaLabel: props.label } : { label: props.label, headingLevel: 3 as const }
    return props.isRibbon ? (
        <SurfaceCard
            kind="figures"
            {...head}
            isLoading={props.isLoading}
            items={props.items}
        />
    ) : (
        <Section kind="figures" ariaLabel={props.label} isLoading={props.isLoading} items={props.items} />
    )
}

/** Props for the gauges of figures. */
interface FiguresProportionProps {
    /** The measured items; while `isLoading`, their labels stay real and the values draw as geometry. */
    readonly points: ReadonlyArray<ChartPoint>
    /** What draws when there is nothing to measure. */
    readonly empty: string
    readonly isLoading: boolean
    /** The line of text under the chart; empty draws none. */
    readonly caption: string
}

/** Props for the bars of figures. */
interface FiguresBarsProps extends FiguresProportionProps {
    /** Names the chart for assistive technology. */
    readonly label: string
}

/** What a captioned chart takes. */
interface CaptionedProps {
    readonly caption: string
    readonly children: ReactNode
}

/** The chart with its caption under it. */
const Captioned = (props: CaptionedProps): ReactNode =>
    props.caption === "" ? (
        props.children
    ) : (
        <Stack gap="row">
            {props.children}
            <Text size="sm" tone="muted">
                {props.caption}
            </Text>
        </Stack>
    )

/** The items as bars on one scale from zero, each value over its bar and its label under it, with the caption under them. */
export const FiguresBars = (props: FiguresBarsProps): ReactNode => (
    <Captioned caption={props.caption}>
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
    </Captioned>
)

/** The items as one gauge each, all on the scale of their sum, so each reads as its share of the whole. */
export const FiguresProportion = (props: FiguresProportionProps): ReactNode => {
    if (!props.isLoading && props.points.length === 0) return <EmptyNotice message={props.empty} />
    const total = proportionTotal(props.points)
    return (
        <Captioned caption={props.caption}>
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
        </Captioned>
    )
}
