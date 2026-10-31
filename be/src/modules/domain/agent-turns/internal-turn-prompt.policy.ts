import type { AgentGoalRecord, AgentTaskRecord } from "@modules/domain/agent-work"
import type { GraphIntent } from "./agent-turns.contracts"

/** The closing mark of the data block, which a wake's words must not be able to write themselves. */
const DATA_END = "</data>"

const dayOf = (moment: Date): string => moment.toISOString().slice(0, 10)

const bracketed = (moment: Date): string => ["[", dayOf(moment), "]"].join("")

const bulletOf = (line: string): string => ["-", line].join(" ")

/** A titled bullet list; nothing at all for an empty list, so a part with nothing to say adds no words. */
export const blockOf = (title: string, lines: ReadonlyArray<string>): string =>
    lines.length === 0 ? "" : [title, ...lines.map(bulletOf)].join("\n")

/** The parts that have words, one blank line apart. */
export const joinParts = (parts: ReadonlyArray<string>): string => parts.filter((part) => part !== "").join("\n\n")

/** One goal as a line: its title, and the day it is due when it has one. */
export const goalLineOf = (goal: AgentGoalRecord): string =>
    goal.dueAt === null ? goal.title : [goal.title, bracketed(goal.dueAt)].join(" ")

/** One task as a line: its key (the name the agent answers with), its title, what it waits for and when it wakes the agent. */
export const taskLineOf = (task: AgentTaskRecord): string => {
    const waiting = task.waitingOn === null ? "" : ` (${task.waitingOn})`
    const next = task.nextActionAt === null ? "" : [" ", bracketed(task.nextActionAt)].join("")
    return `${task.dedupeKey}: ${task.title}${waiting}${next}`
}

/** One intent the action graph allows, as a line: the action key the proposal names, and what it does. */
export const intentLineOf = (intent: GraphIntent): string => `${intent.action}: ${intent.label}`

/** The words of a wake with the data block's own closing mark defused, so they stay data. */
export const dataOf = (text: string): string => text.replaceAll(DATA_END, "< /data>").trim()
