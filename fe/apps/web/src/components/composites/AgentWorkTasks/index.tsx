import { Badge } from "@starci/grammar/common"
import { AgentWorkRowMenu } from "@/components/branches/AgentWorkRowMenu"
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
    readonly isSkeleton: boolean
    readonly onClose: (id: string) => void
}

/** The open tasks of the agent. */
export const AgentWorkTasks = (props: AgentWorkTasksProps) => (
    <AgentWorkRows
        words={props.words}
        isSkeleton={props.isSkeleton}
        rows={props.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            facts: [task.detail, task.waitLabel],
            badges: <Badge tone="accent">{task.statusLabel}</Badge>,
            actions: (
                <AgentWorkRowMenu
                    label={props.words.moreLabel}
                    linkLabel={props.words.openLabel}
                    linkHref={task.workItemHref}
                    commandLabel={props.words.closeLabel}
                    isDanger={false}
                    onCommand={props.canEdit ? () => props.onClose(task.id) : null}
                />
            ),
        }))}
    />
)
