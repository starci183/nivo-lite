import type { AgentGoalRecord, AgentTaskRecord } from "@modules/domain/agent-work"
import { BRIEF_ITEMS } from "../agent-schedules.policy"

/** The longest title a brief repeats. */
const TITLE_CHARS = 80

const titleOf = (title: string): string => (title.length > TITLE_CHARS ? `${title.slice(0, TITLE_CHARS)}...` : title)

/** The names a brief lists: the first few, then how many more there are. */
export const listOf = (names: ReadonlyArray<string>): string => {
    const shown = names.slice(0, BRIEF_ITEMS).map(titleOf).join("; ")
    return names.length > BRIEF_ITEMS ? `${shown}; and ${String(names.length - BRIEF_ITEMS)} more` : shown
}

/** What is due for an agent. */
export interface DueWork {
    /** The open tasks whose wake time has come. */
    readonly tasks: ReadonlyArray<AgentTaskRecord>
    /** The active goals whose due date passed after the agent last looked at them. */
    readonly goals: ReadonlyArray<AgentGoalRecord>
}

/**
 * The tasks and goals of an agent that need it now: an open task whose wake time has come, and an active goal whose due date has passed since
 * the agent last reviewed it (or that it never reviewed).
 */
export const dueWorkOf = (
    tasks: ReadonlyArray<AgentTaskRecord>,
    goals: ReadonlyArray<AgentGoalRecord>,
    now: Date,
): DueWork => ({
    tasks: tasks.filter(
        (task) => task.status === "open" && task.nextActionAt !== null && task.nextActionAt.getTime() <= now.getTime(),
    ),
    goals: goals.filter(
        (goal) =>
            goal.status === "active" &&
            goal.dueAt !== null &&
            goal.dueAt.getTime() <= now.getTime() &&
            (goal.reviewedAt === null || goal.reviewedAt.getTime() < goal.dueAt.getTime()),
    ),
})

/** The brief of due work: what to look at first, in the agent's own titles. */
export const dueBriefOf = (due: DueWork): string => {
    const parts: Array<string> = []
    if (due.tasks.length > 0) parts.push(`Tasks due: ${listOf(due.tasks.map((task) => task.title))}.`)
    if (due.goals.length > 0) parts.push(`Goals past their date: ${listOf(due.goals.map((goal) => goal.title))}.`)
    return parts.join(" ")
}
