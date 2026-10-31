import { isRecord } from "@modules/platform/primitives"
import type {
    AgentBegin,
    AgentFinish,
    AgentLocale,
    AgentProposeResult,
    AgentTurnView,
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

/** The turn a `begun` answer describes, or null when a field is missing or of the wrong kind. */
const turnOf = (agentId: string, scopeKey: string, answer: Record<string, unknown>): AgentTurnView | null => {
    const source = sourceOf(answer.source)
    const createdAt = dateOf(answer.wakeCreatedAt)
    const actor = idOrNull(answer.actorMemberId)
    const { workspaceId, fence, turnId, wakeId, eventKey, context, attempts, maxAttempts } = answer
    if (
        source === null ||
        createdAt === null ||
        actor === undefined ||
        typeof workspaceId !== "string" ||
        typeof fence !== "number" ||
        typeof turnId !== "string" ||
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
        fence,
        turnId,
        wakeId,
        source,
        eventKey,
        context: contextOf(context),
        actorMemberId: actor,
        attempts,
        maxAttempts,
        wakeCreatedAt: createdAt,
        proposal: answer.proposal ?? null,
    }
}

/** Reads the answer of `agent_turn_begin` for the agent and scope it was asked about; null when it is not one of the four shapes. */
export const parseBegin = (value: unknown, agentId: string, scopeKey: string): AgentBegin | null => {
    if (!isRecord(value)) return null
    const result = value.result
    if (result === "killed" || result === "busy" || result === "idle") return { result }
    if (result !== "begun") return null
    const turn = turnOf(agentId, scopeKey, value)
    return turn === null ? null : { result: "begun", turn }
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
