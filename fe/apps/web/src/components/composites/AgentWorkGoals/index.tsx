import { Badge, Button } from "@starci/grammar/common"
import { AgentWorkRows } from "@/components/branches/AgentWorkRows"
import type { AgentWorkGoalView } from "@/modules/types"

/** The goals of the agent, each with the command that finishes it. */
interface AgentWorkGoalsProps {
    readonly label: string
    readonly emptyMessage: string
    readonly doneLabel: string
    readonly goals: ReadonlyArray<AgentWorkGoalView>
    readonly canEdit: boolean
    readonly isSaving: boolean
    readonly isSkeleton: boolean
    readonly onDone: (goal: AgentWorkGoalView) => void
}

/** The goals the agent works toward. */
export const AgentWorkGoals = (props: AgentWorkGoalsProps) => (
    <AgentWorkRows
        words={{ label: props.label, emptyMessage: props.emptyMessage }}
        isSkeleton={props.isSkeleton}
        rows={props.goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            facts: [goal.detail, goal.dueLabel],
            badges:
                goal.statusLabel === "" ? undefined : (
                    <Badge tone={goal.isOpen ? "accent" : "neutral"}>{goal.statusLabel}</Badge>
                ),
            actions:
                props.canEdit && goal.isOpen ? (
                    <Button intent="neutral" size="sm" isDisabled={props.isSaving} onPress={() => props.onDone(goal)}>
                        {props.doneLabel}
                    </Button>
                ) : undefined,
        }))}
    />
)
