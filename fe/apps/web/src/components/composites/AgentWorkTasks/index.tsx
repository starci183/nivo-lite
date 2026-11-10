import { AgentWorkRows } from "@/components/branches/AgentWorkRows"
import type { AgentWorkTaskView } from "@/modules/types"

/** What the agent is on, what each task waits for, and the way to its work item. */
interface AgentWorkTasksProps {
    readonly words: {
        readonly label: string
        readonly emptyMessage: string
        readonly moreLabel: string
        readonly openLabel: string
        readonly closeLabel: string
    }
    readonly tasks: ReadonlyArray<AgentWorkTaskView>
    readonly canEdit: boolean
    readonly isLoading: boolean
    readonly onClose: (id: string) => void
}

/** The ways a row is acted on: the record it opened as its action, the close command as its menu, or alone as its action. */
const taskCommandsOf = (task: AgentWorkTaskView, props: AgentWorkTasksProps) => {
    const close = props.canEdit ? { label: props.words.closeLabel, onAction: () => props.onClose(task.id) } : null
    if (task.workItemHref === null)
        return close === null ? {} : { action: { label: close.label, press: close.onAction } }
    const action = { label: props.words.openLabel, href: task.workItemHref, endArrow: true as const }
    return close === null ? { action } : { action, menu: { label: props.words.moreLabel, entries: [{ id: "close", ...close }] } }
}

/** The open tasks of the agent. */
export const AgentWorkTasks = (props: AgentWorkTasksProps) => (
    <AgentWorkRows
        words={props.words}
        emptyIcon="play"
        isLoading={props.isLoading}
        rows={props.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            facts: [task.detail, task.waitLabel],
            ...taskCommandsOf(task, props),
        }))}
    />
)
