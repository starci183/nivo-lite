import { Badge, Button, Text } from "@starci/grammar/common"
import { AgentWorkRows } from "@/components/branches/AgentWorkRows"
import type { AgentWorkTurnsView } from "@/modules/types"

/** The recent turns of the agent: why it woke, what it did, what it cost. */
interface AgentWorkTurnsProps {
    readonly label: string
    readonly emptyMessage: string
    readonly openLabel: string
    readonly turns: AgentWorkTurnsView
    readonly isSkeleton: boolean
}

/** The turns that did something, newest first, and the wakes that found nothing to do as one count under them. */
export const AgentWorkTurns = (props: AgentWorkTurnsProps) => (
    <>
        <AgentWorkRows
            words={{ label: props.label, emptyMessage: props.emptyMessage }}
            isSkeleton={props.isSkeleton}
            rows={props.turns.rows.map((turn) => ({
                id: turn.id,
                title: turn.sourceLabel,
                facts: [turn.wokeLabel, turn.usageLabel],
                badges: <Badge tone={turn.outcomeTone}>{turn.outcomeLabel}</Badge>,
                actions:
                    turn.workItemHref === null ? undefined : (
                        <Button intent="neutral" size="sm" href={turn.workItemHref}>
                            {props.openLabel}
                        </Button>
                    ),
            }))}
        />
        {props.turns.quietLabel === "" ? null : (
            <Text size="sm" tone="muted">
                {props.turns.quietLabel}
            </Text>
        )}
    </>
)
