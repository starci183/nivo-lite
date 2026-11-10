import { SurfaceCard, Text } from "@starci/grammar/common"
import type { TeamChatStopCardView, TeamChatStopLineView } from "@/modules/types"

/** A named set of name/value rows of a stop card. */
export interface StopLinesListProps {
    readonly label: string
    readonly lines: ReadonlyArray<TeamChatStopLineView>
}

/** Name/value rows inside the card: a bordered list with full-width dividers (surface in surface), never a grey box. */
export const StopLinesList = (props: StopLinesListProps) => (
    <SurfaceCard
        kind="list"
        layout="keyValue"
        ariaLabel={props.label}
        empty={null}
        items={props.lines.map((line) => ({ id: line.id, title: line.name, value: line.value }))}
    />
)

/** The card whose replies are drawn. */
export interface StopTraceListProps {
    readonly card: TeamChatStopCardView
}

/** The replies left on the card, oldest first: what was said or pressed, then who and when (12, muted). */
export const StopTraceList = (props: StopTraceListProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.card.labels.traceLabel}
        empty={null}
        items={props.card.replies.map((reply) => ({
            id: reply.id,
            title: reply.title,
            description: (
                <Text as="span" size="xs" tone="muted">
                    {reply.line}
                </Text>
            ),
        }))}
    />
)
