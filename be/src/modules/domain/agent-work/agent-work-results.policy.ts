import { isRecord } from "@modules/platform/primitives"
import type { AgentBegin, AgentEndedWake, AgentFinish, AgentProposeResult } from "./agent-work-turns.contracts"
import type {
    AgentLocale,
    AgentTurnView,
    AgentWakeView,
    AgentWakeContext,
    AgentWakeSource,
    AgentWorkDue,
} from "./agent-work.contracts"

const CONTEXT_TEXT_KEYS = [
    "conversationId",
    "messageId",
    "channelEventId",
    "room",
    "threadId",
    "authorUserId",
    "triggerId",
    "slot",
    "eventName",
    "subjectId",
    "taskId",
    "probeKey",
] as const

const sourceOf = (value: unknown): AgentWakeSource | null => {
    if (value === "customer" || value === "tag" || value === "internal" || value === "schedule") return value
    return null
}

const localeOf = (value: unknown): AgentLocale | undefined => {
    if (value === "vi" || value === "en") return value
    return undefined
}

const dateOf = (value: unknown): Date | null => {
    if (typeof value !== "string") return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

const idOrNull = (value: unknown): string | null | undefined => {
    if (value === null) return null
    return typeof value === "string" ? value : undefined
}

/** Reads a stored wake context: only the keys the contract names, each of its own kind; anything else is dropped. */
export const contextOf = (value: unknown): AgentWakeContext => {
    if (!isRecord(value)) return {}
    const texts = CONTEXT_TEXT_KEYS.flatMap((key) => {
        const text = value[key]
        return typeof text === "string" ? [[key, text] as const] : []
    })
    const locale = localeOf(value.locale)
    return {
        ...Object.fromEntries(texts),
        ...(typeof value.lookupName === "boolean" ? { lookupName: value.lookupName } : {}),
        ...(locale === undefined ? {} : { locale }),
    }
}

/** The wake an answer describes, or null when a field is missing or of the wrong kind. */
const wakeOf = (agentId: string, scopeKey: string, answer: Record<string, unknown>): AgentWakeView | null => {
    const source = sourceOf(answer.source)
    const createdAt = dateOf(answer.wakeCreatedAt)
    const actor = idOrNull(answer.actorMemberId)
    const { workspaceId, wakeId, eventKey, context, attempts, maxAttempts } = answer
    if (
        source === null ||
        createdAt === null ||
        actor === undefined ||
        typeof workspaceId !== "string" ||
        typeof wakeId !== "string" ||
        typeof eventKey !== "string" ||
        typeof attempts !== "number" ||
        typeof maxAttempts !== "number"
    ) {
        return null
    }
    return {
        workspaceId,
        agentId,
        scopeKey,
        wakeId,
        source,
        eventKey,
        context: contextOf(context),
        actorMemberId: actor,
        attempts,
        maxAttempts,
        wakeCreatedAt: createdAt,
    }
}

/** The turn a `begun` answer describes, or null when a field is missing or of the wrong kind. */
const turnOf = (agentId: string, scopeKey: string, answer: Record<string, unknown>): AgentTurnView | null => {
    const wake = wakeOf(agentId, scopeKey, answer)
    const { fence, turnId } = answer
    if (wake === null || typeof fence !== "number" || typeof turnId !== "string") return null
    return { ...wake, fence, turnId, proposal: answer.proposal ?? null }
}

/** The wakes `begin` ended itself, or null when one is of the wrong shape; a missing list is none. */
const endedOf = (agentId: string, scopeKey: string, value: unknown): ReadonlyArray<AgentEndedWake> | null => {
    if (value === undefined) return []
    if (!Array.isArray(value)) return null
    const entries: ReadonlyArray<unknown> = value
    const ended: Array<AgentEndedWake> = []
    for (const entry of entries) {
        if (!isRecord(entry) || (entry.state !== "held" && entry.state !== "dead")) return null
        const wake = wakeOf(agentId, scopeKey, entry)
        if (wake === null) return null
        ended.push({ state: entry.state, wake })
    }
    return ended
}

/** Reads the answer of `agent_turn_begin` for the agent and scope it was asked about; null when it is not one of the four shapes. */
export const parseBegin = (value: unknown, agentId: string, scopeKey: string): AgentBegin | null => {
    if (!isRecord(value)) return null
    const ended = endedOf(agentId, scopeKey, value.ended)
    if (ended === null) return null
    const result = value.result
    if (result === "killed" || result === "busy" || result === "idle") return { result, ended }
    if (result !== "begun") return null
    const turn = turnOf(agentId, scopeKey, value)
    return turn === null ? null : { result: "begun", turn, ended }
}

/** Reads the answer of `agent_turn_finish`; null when it is not `{fenced, more}`. */
export const parseFinish = (value: unknown): AgentFinish | null => {
    if (!isRecord(value) || typeof value.fenced !== "boolean" || typeof value.more !== "boolean") return null
    return { fenced: value.fenced, more: value.more }
}

/** Reads the answer of `agent_turn_propose`; null when it is none of the three words. */
export const parsePropose = (value: unknown): AgentProposeResult | null => {
    if (value === "stored" || value === "fenced" || value === "killed") return value
    return null
}

const dueKindOf = (value: unknown): AgentWorkDue["kind"] | null => {
    if (value === "lease" || value === "wake" || value === "task" || value === "trigger") return value
    return null
}

const dueAtOf = (value: unknown): Date | null => (value instanceof Date ? value : dateOf(value))

/** Reads one row of `agent_work_due`; null when it is of the wrong shape. */
const dueOf = (row: unknown): AgentWorkDue | null => {
    if (!isRecord(row)) return null
    const kind = dueKindOf(row.due_kind)
    const subject = idOrNull(row.due_subject)
    const { due_agent: agentId, due_workspace: workspaceId, due_scope: scopeKey } = row
    if (
        kind === null ||
        subject === undefined ||
        typeof agentId !== "string" ||
        typeof workspaceId !== "string" ||
        typeof scopeKey !== "string"
    ) {
        return null
    }
    return { kind, agentId, workspaceId, scopeKey, subjectId: subject, at: dueAtOf(row.due_at) }
}

/** Reads the rows of `agent_work_due`; null when any row is of the wrong shape, so a half-read sweep never drives half of the work. */
export const parseDue = (rows: ReadonlyArray<unknown>): ReadonlyArray<AgentWorkDue> | null => {
    const due = rows.map(dueOf)
    return due.every((entry) => entry !== null) ? due : null
}
