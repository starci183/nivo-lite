import { Badge, DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { LINES_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** One figure of the week. */
interface WeekStatView {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly meta: string
    /** The figure needs a look: it is drawn as a danger dot. */
    readonly isAlert: boolean
}

/** Copy and figures the connected stats block supplies. */
export interface ShiftsWeekStatsBaseProps {
    readonly props: {
        readonly ariaLabel: string
        readonly stats: ReadonlyArray<WeekStatView>
        readonly explainTitle: string
        readonly explainNone: string
        readonly lines: ReadonlyArray<{ readonly id: string; readonly text: string }>
        /** Who wrote the explanation, or `null` when there is none yet. */
        readonly source: { readonly label: string; readonly isOpenClaw: boolean } | null
        /** The explanation card is shown (there is a text, or the draft is waiting for one). */
        readonly hasExplanation: boolean
    }
}

/** Draws the figures strip of the week and the explanation card of its schedule. */
export const ShiftsWeekStatsBase = (props: ShiftsWeekStatsBaseProps) => (
    <div className={PANEL_CLASS_NAME}>
        <SurfaceCard ariaLabel={props.props.ariaLabel}>
            <DescriptionList
                layout="stat-strip"
                isDivided
                items={props.props.stats.map((stat) => ({
                    id: stat.id,
                    term: stat.term,
                    description: stat.isAlert ? (
                        <Badge tone="danger" isDot>
                            {stat.value}
                        </Badge>
                    ) : (
                        stat.value
                    ),
                    meta: stat.meta,
                }))}
            />
        </SurfaceCard>
        {props.props.hasExplanation ? (
            <SurfaceCard
                label={props.props.explainTitle}
                headingLevel={2}
                labelEnd={
                    props.props.source === null ? null : (
                        <Badge tone={props.props.source.isOpenClaw ? "accent" : "neutral"}>
                            {props.props.source.label}
                        </Badge>
                    )
                }
            >
                {props.props.lines.length === 0 ? (
                    <Text size="sm" tone="muted">
                        {props.props.explainNone}
                    </Text>
                ) : (
                    <div className={LINES_CLASS_NAME}>
                        {props.props.lines.map((line) => (
                            <Text key={line.id} size="sm">
                                {line.text}
                            </Text>
                        ))}
                    </div>
                )}
            </SurfaceCard>
        ) : null}
    </div>
)
