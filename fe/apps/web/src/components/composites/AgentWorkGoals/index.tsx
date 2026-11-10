import type { ReactNode } from "react"
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
    readonly isLoading: boolean
    /** The command in the foot of the card. */
    readonly add?: { readonly label: string; readonly onPress: () => void }
    /** What stands under the rows in the card. */
    readonly footer?: ReactNode
    readonly onDone: (goal: AgentWorkGoalView) => void
}

/** The goals the agent works toward. */
export const AgentWorkGoals = (props: AgentWorkGoalsProps) => (
    <AgentWorkRows
        words={{ label: props.label, emptyMessage: props.emptyMessage }}
        emptyIcon="goal"
        {...(props.footer === undefined ? {} : { footer: props.footer })}
        {...(props.add === undefined ? {} : { add: props.add })}
        isLoading={props.isLoading}
        rows={props.goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            facts: [goal.detail, goal.dueLabel],
            ...(goal.statusLabel === ""
                ? {}
                : { badges: [{ label: goal.statusLabel, tone: goal.isOpen ? ("accent" as const) : ("neutral" as const) }] as const }),
            ...(props.canEdit && goal.isOpen
                ? { action: { label: props.doneLabel, isDisabled: props.isSaving, press: () => props.onDone(goal) } }
                : {}),
        }))}
    />
)
