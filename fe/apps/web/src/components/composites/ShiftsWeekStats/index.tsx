import type { ShiftsWeekViews } from "@/modules/types"
type ShiftsWeekStatsProps = ShiftsWeekViews["weekStats"] & {
    readonly isLoading?: boolean
}
import { Badge, SurfaceCard, Text, Stack } from "@starci/grammar/common"
import { ShiftsFigureStrip } from "@/components/leaves/ShiftsFigureStrip"

/** The badge that names where the explanation came from; nothing while the source is unknown. */
const sourceBadgeOf = (props: ShiftsWeekStatsProps) =>
    props.source === null ? null : (
        <Badge
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            tone={props.source.isOpenClaw ? "accent" : "neutral"}
        >
            {props.source.label}
        </Badge>
    )

/** The lines that explain the schedule of the week, or the note that there are none. */
const ExplanationLines = (props: ShiftsWeekStatsProps) =>
    props.lines.length === 0 ? (
        <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
            {props.explainNone}
        </Text>
    ) : (
        <Stack gap="row">
            {props.lines.map((line) => (
                <Text
                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    key={line.id}
                    size="sm"
                >
                    {line.text}
                </Text>
            ))}
        </Stack>
    )

/** Draws the figures strip of the week and the explanation card of its schedule. */
export const ShiftsWeekStats = (props: ShiftsWeekStatsProps) => (
    <Stack gap="section">
        <ShiftsFigureStrip
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            ariaLabel={props.ariaLabel}
            captions={props.captions}
            stats={props.stats}
            alerts={props.stats.filter((stat) => stat.isAlert)}
        />
        {props.hasExplanation ? (
            <SurfaceCard
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                label={props.explainTitle}
                headingLevel={2}
                labelEnd={sourceBadgeOf(props)}
            >
                <ExplanationLines {...props} />
            </SurfaceCard>
        ) : null}
    </Stack>
)
