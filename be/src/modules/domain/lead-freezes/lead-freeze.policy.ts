import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    FreezeState,
    FreezeSubject,
    LeadFreeze,
    PendingContextValue,
    PendingEvent,
    PendingKind,
} from "./lead-freezes.contracts"

/** The prefix of the key of a freeze about a lead. */
export const CONTACT_KEY = "contact:"

/** The prefix of the key of a freeze about the conversation of a customer who is not a lead yet. */
export const CONVERSATION_KEY = "conversation:"

/** The subject kind of a wake about a bank transaction (`bank-transaction:<id>`). */
const TRANSACTION_SUBJECT = "bank-transaction"

/** The most events one hold keeps; past it the oldest folded ones (history) go first, then nothing new is lost but the count. */
export const PENDING_MAX = 500

/** The mark of a wake written again after a freeze, so a replay is never held for the freeze it came from. */
export const REPLAY_MARK = "~after-freeze-"

/**
 * The reason a freeze names when it is the hold of a thread run's stop: no owner item, no retry of its own. The stop (its card, its
 * answer box, its three decisions) is the one thing that tells the founder; the freeze only holds the customer's new wakes and
 * replays them once the stop closes.
 */
export const THREAD_STOP_REASON = "run_stop"

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The subject of a trigger scope as the flows wrote it (`{ kind, id }`) or as a wake's label (`<kind>:<id>`), or null. */
const subjectOf = (value: unknown): { readonly kind: string; readonly id: string } | null => {
    if (typeof value === "string") {
        const at = value.indexOf(":")
        return at <= 0 || at === value.length - 1 ? null : { kind: value.slice(0, at), id: value.slice(at + 1) }
    }
    if (typeof value !== "object" || value === null) return null
    const kind = textOf(Reflect.get(value, "kind"))
    const id = textOf(Reflect.get(value, "id"))
    return kind === null || id === null ? null : { kind, id }
}

/**
 * What ties a freeze to ONE workflow of its customer inside the key (`contact:<id>|wf:<workflowId>`). A freeze holds the workflow whose
 * run stopped, never the customer as a whole: their other workflows, and so their other messages, are still served. A key without
 * the mark is a freeze written before workflows were told apart (or of an agent's own graph) and holds the customer as a whole.
 */
export const WORKFLOW_MARK = "|wf:"

/** The workflow a trigger scope is about (the workflow its run is pinned to), or null. */
export const workflowOfTrigger = (trigger: Readonly<Record<string, unknown>>): string | null => textOf(trigger.workflowId)

/** The workflow a freeze holds, read from its key; null for a freeze that holds its customer as a whole. */
export const workflowOfKey = (key: string): string | null => {
    const at = key.indexOf(WORKFLOW_MARK)
    return at < 0 ? null : key.slice(at + WORKFLOW_MARK.length)
}

const keyed = (base: string, workflowId: string | null): string =>
    workflowId === null ? base : `${base}${WORKFLOW_MARK}${workflowId}`

/** Who a trigger is about, by what it names itself: the lead, else the conversation, in the workflow it names; null when it names neither. */
export const subjectOfTrigger = (trigger: Readonly<Record<string, unknown>>): FreezeSubject | null => {
    const contactId = textOf(trigger.contactId)
    const conversationId = textOf(trigger.conversationId)
    const workflowId = workflowOfTrigger(trigger)
    if (contactId !== null) return { key: keyed(`${CONTACT_KEY}${contactId}`, workflowId), contactId, conversationId }
    if (conversationId !== null) {
        return { key: keyed(`${CONVERSATION_KEY}${conversationId}`, workflowId), contactId: null, conversationId }
    }
    return null
}

/** The subject of a lead in one workflow, with the conversation it came from when known. */
export const contactSubjectOf = (
    contactId: string,
    conversationId: string | null,
    workflowId: string | null = null,
): FreezeSubject => ({
    key: keyed(`${CONTACT_KEY}${contactId}`, workflowId),
    contactId,
    conversationId,
})

/**
 * The keys a trigger may be held under, most specific first: its lead then its conversation in the workflow it names, then the same
 * two without a workflow (a freeze that holds the customer as a whole).
 */
export const keysOf = (trigger: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
    const contactId = textOf(trigger.contactId)
    const conversationId = textOf(trigger.conversationId)
    const workflowId = workflowOfTrigger(trigger)
    const bases = [
        ...(contactId === null ? [] : [`${CONTACT_KEY}${contactId}`]),
        ...(conversationId === null ? [] : [`${CONVERSATION_KEY}${conversationId}`]),
    ]
    return workflowId === null ? bases : [...bases.map((base) => keyed(base, workflowId)), ...bases]
}

/** The bank transaction a wake is about (the bank feed's tag), or null. */
export const transactionOf = (trigger: Readonly<Record<string, unknown>>): string | null => {
    const subject = subjectOf(trigger.subject)
    return subject?.kind === TRANSACTION_SUBJECT ? subject.id : null
}

/**
 * The credit a wake is about, whoever started it: the bank feed's subject (`bank-transaction:<id>`), else the `transactionId` the start
 * of the workflow carries (the rematch job's `engine.workflow` start names nothing else), else null.
 */
export const creditOf = (trigger: Readonly<Record<string, unknown>>): string | null =>
    transactionOf(trigger) ?? textOf(trigger.transactionId)

/** Whether a scope member is the channel identity of a person (`EventSubject`: the channel and the channel's id of them). */
const isSubjectOf = (value: unknown): boolean =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "channel") === "string" && typeof Reflect.get(value, "id") === "string"

/** What kind of event a held wake is, from where it came and what it names. */
export const pendingKindOf = (source: string, trigger: Readonly<Record<string, unknown>>): PendingKind => {
    if (creditOf(trigger) !== null) return "payment"
    // A person's message: an event of the one pipeline about a channel identity (its `subject`, the shape ENRICH met a person by; the
    // source is `trigger` for every pipeline event, so the source alone does not tell).
    if (isSubjectOf(trigger.subject)) return "message"
    if (source === "schedule" || textOf(trigger.triggerId) !== null || textOf(trigger.taskId) !== null) return "timer"
    if (source === "tag" || source === "agent") return "handoff"
    return "event"
}

/** The flags and texts of a wake's context, as a pending event keeps them; anything else is dropped. */
export const contextRecordOf = (context: object): Readonly<Record<string, PendingContextValue>> =>
    Object.fromEntries(
        Object.entries(context).filter(
            (entry): entry is [string, PendingContextValue] =>
                typeof entry[1] === "string" || typeof entry[1] === "boolean",
        ),
    )

/** The customer messages a trigger scope carries, oldest first. */
export const messageIdsOf = (trigger: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
    const ids = trigger.messageIds
    if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === "string")
    const first = textOf(trigger.messageId)
    return first === null ? [] : [first]
}

/** The held wake as the freeze keeps it. */
export interface HeldWake {
    /** The wake. */
    readonly wakeId: string
    /** The agent it woke. */
    readonly agentId: string
    /** Where it came from. */
    readonly source: string
    /** The fact's key. */
    readonly eventKey: string
    /** The lock scope it ran under. */
    readonly scopeKey: string
    /** Its ids and flags. */
    readonly context: object
    /** The member behind it, when a person was. */
    readonly actorMemberId: string | null
}

/** The pending event of a held wake. */
export const pendingEventOf = (
    wake: HeldWake,
    trigger: Readonly<Record<string, unknown>>,
    at: string,
): PendingEvent => {
    const kind = pendingKindOf(wake.source, trigger)
    return {
        wakeId: wake.wakeId,
        agentId: wake.agentId,
        source: wake.source,
        eventKey: wake.eventKey,
        scopeKey: wake.scopeKey,
        context: contextRecordOf(wake.context),
        actorMemberId: wake.actorMemberId,
        kind,
        at,
        conversationId: kind === "message" ? textOf(trigger.conversationId) : null,
        messageIds: kind === "message" ? messageIdsOf(trigger) : [],
        folded: false,
        trigger: jsonObjectOf(trigger),
    }
}

/** A value as plain JSON, or undefined for one JSON cannot carry (a function, a symbol, a number that is not finite). */
const jsonValueOf = (value: unknown): JsonValue | undefined => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined
    if (Array.isArray(value)) return value.flatMap((one: unknown) => jsonValueOf(one) ?? [])
    if (typeof value === "object") return jsonObjectOf(value)
    return undefined
}

/** An object as plain JSON: every member JSON can carry, as written. */
export const jsonObjectOf = (value: object): JsonObject =>
    Object.fromEntries(
        Object.entries(value).flatMap(([name, member]: [string, unknown]) => {
            const json = jsonValueOf(member)
            return json === undefined ? [] : [[name, json]]
        }),
    )

/**
 * The events of a released hold a run TOOK into a step's queue snapshot (ROAD-API section 4): they are that run's work and are never
 * replayed. Recorded on each event when the step took it, never inferred from the decision that closed the stop.
 */
export const takenByRun = (pending: ReadonlyArray<PendingEvent>): ReadonlyArray<PendingEvent> =>
    pending.filter((event) => event.taken !== undefined)

/** The events with `taken` set on the ones whose wakes a step visit took (`<run>:<step>:<visit>`); the others as they are. */
export const withTaken = (
    pending: ReadonlyArray<PendingEvent>,
    wakeIds: ReadonlySet<string>,
    visit: string,
): ReadonlyArray<PendingEvent> =>
    pending.map((event) => (event.taken === undefined && wakeIds.has(event.wakeId) ? { ...event, taken: visit } : event))

/** The events with one more at the end; a wake already recorded is not recorded twice. */
export const withPending = (pending: ReadonlyArray<PendingEvent>, event: PendingEvent): ReadonlyArray<PendingEvent> => {
    if (pending.some((each) => each.wakeId === event.wakeId)) return pending
    const kept = pending.length < PENDING_MAX ? pending : dropOldestFolded(pending)
    return [...kept, event]
}

const dropOldestFolded = (pending: ReadonlyArray<PendingEvent>): ReadonlyArray<PendingEvent> => {
    const at = pending.findIndex((each) => each.folded)
    return at < 0 ? pending : [...pending.slice(0, at), ...pending.slice(at + 1)]
}

/** The key a replayed wake is written under: the event's own, marked with the freeze and its episode, so one release writes it once. */
export const replayKeyOf = (event: PendingEvent, freezeId: string, episode: number): string =>
    `${event.eventKey}${REPLAY_MARK}${freezeId}-${episode}`

/** Whether a freeze still holds its customer. */
export const holds = (freeze: LeadFreeze | null): freeze is LeadFreeze & { readonly status: "frozen" | "retrying" } =>
    freeze !== null && freeze.status !== "released"

/** What the pages read of a freeze that holds its customer; null for one that does not. */
export const stateOf = (freeze: LeadFreeze | null): FreezeState | null => {
    if (!holds(freeze)) return null
    return {
        id: freeze.id,
        status: freeze.status,
        workflowId: workflowOfKey(freeze.key),
        contactId: freeze.contactId,
        conversationId: freeze.conversationId,
        runId: freeze.frozenRunId,
        stepTitle: freeze.stepTitle,
        reason: freeze.frozenReason,
        workItemId: freeze.workItemId,
        pendingCount: freeze.pending.filter((each) => !each.folded).length,
        heldBy: freeze.heldBy,
        frozenAt: freeze.frozenAt,
        onStop: freeze.frozenReason === THREAD_STOP_REASON,
    }
}
