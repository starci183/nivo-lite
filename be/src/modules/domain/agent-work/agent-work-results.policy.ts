import { isRecord } from "@modules/platform/primitives"
import { wakeSources } from "./agent-wake-source.policy"
import type { AgentBegin, AgentEndedWake, AgentFinish, AgentProposeResult } from "./agent-work-turns.contracts"
import type {
    AgentLocale,
    AgentTurnView,
    AgentWakeView,
    AgentWakeContext,
    AgentWakeSource,
    AgentWorkDue,
} from "./agent-work.contracts"

/** The keys of a wake context that hold text. */
type ContextTextKey = {
    [Key in keyof AgentWakeContext]-?: NonNullable<AgentWakeContext[Key]> extends string ? Key : never
}[keyof AgentWakeContext]

/**
 * Every text key of the wake context, as a record so the compiler refuses a key added to the contract and forgotten here: a key left
 * out is dropped on every read, and what a door wrote (a tag's words, a burst's merged messages) silently never reaches the turn.
 */
const CONTEXT_TEXT_KEY_SET: Readonly<Record<Exclude<ContextTextKey, "locale">, true>> = {
    conversationId: true,
    messageId: true,
    channelEventId: true,
    room: true,
    threadId: true,
    mergedMessageIds: true,
    tagContext: true,
    text: true,
    subject: true,
    tagSource: true,
    channel: true,
    leadId: true,
    authorAgentId: true,
    authorUserId: true,
    triggerId: true,
    slot: true,
    eventName: true,
    subjectId: true,
    taskId: true,
    probeKey: true,
    intent: true,
    inbound: true,
}

const isContextTextKey = (key: string): key is Exclude<ContextTextKey, "locale"> => key in CONTEXT_TEXT_KEY_SET

const CONTEXT_TEXT_KEYS = Object.keys(CONTEXT_TEXT_KEY_SET).filter(isContextTextKey)

const sourceOf = (value: unknown): AgentWakeSource | null =>
    typeof value === "string" && wakeSources.lookup(value) !== undefined ? value : null

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
export const storedWakeContextOf = (value: unknown): AgentWakeContext => {
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
        context: storedWakeContextOf(context),
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

/**
 * The wait an `idle` answer tells, or nothing: both fields must be there and of their kind. An answer of a database that has not
 * the function which tells the wait carries neither, and reads as a plain `idle`.
 */
const waitOf = (answer: Record<string, unknown>): Pick<Extract<AgentBegin, { result: "idle" }>, "wait"> => {
    const { waitMs, waitFor } = answer
    if (typeof waitMs !== "number" || !Number.isFinite(waitMs) || waitMs <= 0 || typeof waitFor !== "string") return {}
    return { wait: { ms: Math.ceil(waitMs), wakeId: waitFor } }
}

/** Reads the answer of `agent_turn_begin` for the agent and scope it was asked about; null when it is not one of the four shapes. */
export const parseBegin = (value: unknown, agentId: string, scopeKey: string): AgentBegin | null => {
    if (!isRecord(value)) return null
    const ended = endedOf(agentId, scopeKey, value.ended)
    if (ended === null) return null
    const result = value.result
    if (result === "killed" || result === "busy") return { result, ended }
    if (result === "idle") return { result, ended, ...waitOf(value) }
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
