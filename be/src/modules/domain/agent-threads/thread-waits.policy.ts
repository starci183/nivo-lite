import { z } from "zod"
import {
    WAIT_ROUTE_MEMBER,
    WAIT_TIMEOUT_ROUTE,
    conditionsHold,
    triggerConditionSchema,
    type LoopEvery,
    type TriggerCondition,
} from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { compareTruth } from "@nivo-lite/agent-sdk/template"
import { triggerSpecOf } from "@modules/domain/trigger-specs"

/*
 * `wait({ for, timeout, next })` on a thread (generic, no business): the step PARKS the run on LangGraph's interrupt with the triggers it
 * listens for (their verbs, `where`, the match values read from the run when the wait began) and the run's subject, and arms ONE stored
 * deadline job; the first of (an event the wait takes, the deadline) writes ONE wake of the run's scope keyed by the park
 * (`thread:<run>:wait:<park key>`: the once-key), whose drive resumes the SAME thread with what came. A second comer (the deadline after
 * the event, an event after the deadline, the same event again) finds the key written and resumes nothing; an event of a verb the wait
 * does not list, or about another subject, never reaches it and follows its own road. Pure.
 */

/** The `kind` of the question a parked wait's interrupt carries (never a stop for a person: it names no `stepKey`). */
export const WAIT_PARK_KIND = "wait"

/**
 * The mark a wait's deadline job carries in the thread-deadline payload's `answered` member (a stop's count of answers is never negative,
 * a loop park's mark is -1): the job is never read as a stop's deadline or a round's timer.
 */
export const WAIT_PARK_ANSWERED = -2

/** The members an event and a run are always compared by, besides the verb's declared subject: the engine's person and the conversation. */
const CORE_SUBJECT_MEMBERS: ReadonlyArray<string> = ["contactId", "conversationId"]

/** One test of a waited event, its value already read from the run. */
export interface WaitParkMatch {
    /** The event member the test reads. */
    readonly member: string
    /** How the member is compared: equal, or contains. */
    readonly op: "eq" | "contains"
    /** The value it is compared with. */
    readonly value: JsonValue
    /** Set to compare texts without regard to case. */
    readonly caseFold?: true | undefined
}

/** One trigger a parked wait listens for. */
export interface WaitParkOn {
    /** The key the wake names this trigger by. */
    readonly key: string
    /** The verb of the trigger's event. */
    readonly verb: string
    /** The conditions the event must meet. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
    /** The tests of the event, their values read from the run. */
    readonly match?: ReadonlyArray<WaitParkMatch> | undefined
}

/** What a parked wait hands LangGraph's `interrupt` (plain JSON, in the checkpoint). */
export interface WaitPark {
    /** Marks the interrupt as a wait. */
    readonly kind: typeof WAIT_PARK_KIND
    /** The step key of the wait (an iteration's own inside a loop): the key its deadline job and its once-key are filed under. */
    readonly parkKey: string
    /** When the time runs out (ISO 8601). */
    readonly dueAt: string
    /** The triggers the wait listens for. */
    readonly on: ReadonlyArray<WaitParkOn>
    /** The run's subject members as its trigger held them when the wait began (non-empty texts only). */
    readonly subject: Readonly<Record<string, string>>
}

/** What came to a wait: one of its triggers' events, or the timeout. */
export type WaitCame =
    | { readonly key: string; readonly event: Readonly<Record<string, JsonValue>> }
    | { readonly timeout: true }

/** The decision a wake resumes a parked wait with. */
export interface WaitDecision {
    /** Marks the decision as a wait's. */
    readonly kind: typeof WAIT_PARK_KIND
    /** The park the decision resumes. */
    readonly parkKey: string
    /** What came: an event of a trigger, or the timeout. */
    readonly came: WaitCame
    /** When it was applied (ISO 8601). */
    readonly at: string
}

/** Whether a value is a plain record (no array). */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const MINUTE_MS = 60_000

/** The milliseconds of a wait's timeout (one unit), or null for one that is not one whole unit. */
export const timeoutMsOf = (timeout: unknown): number | null => {
    if (!isRecord(timeout)) return null
    const units: ReadonlyArray<readonly [keyof LoopEvery, number]> = [
        ["minutes", MINUTE_MS],
        ["hours", 60 * MINUTE_MS],
        ["days", 24 * 60 * MINUTE_MS],
    ]
    const given = units.filter(([unit]) => timeout[unit] !== undefined)
    const [only, ...others] = given
    if (only === undefined || others.length > 0) return null
    const amount = timeout[only[0]]
    return typeof amount === "number" && Number.isInteger(amount) && amount > 0 ? amount * only[1] : null
}

/** A JSON value as stored, or null. */
export const jsonOf = (value: unknown): JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (Array.isArray(value)) return value.map((one: unknown) => jsonOf(one))
    if (!isRecord(value)) return null
    return Object.fromEntries(Object.entries(value).map(([name, member]) => [name, jsonOf(member)]))
}

/** One match test as resolved params give it, or null when it is not one. */
const matchOf = (value: unknown): WaitParkMatch | null => {
    if (!isRecord(value) || typeof value.member !== "string" || (value.op !== "eq" && value.op !== "contains")) return null
    return {
        member: value.member,
        op: value.op,
        value: jsonOf(value.value ?? null),
        ...(value.op === "contains" && value.caseFold === true ? { caseFold: true } : {}),
    }
}

/** A trigger's `where` as stored, or null when it is no list of trigger conditions. */
const whereOf = (value: unknown): ReadonlyArray<TriggerCondition> | null => {
    const parsed = z.array(triggerConditionSchema).safeParse(value)
    return parsed.success ? parsed.data : null
}

/** The triggers of a wait as its resolved params give them, or null when they cannot be read. */
export const waitOnOf = (value: unknown): ReadonlyArray<WaitParkOn> | null => {
    if (!Array.isArray(value) || value.length === 0) return null
    const read = value.map((entry: unknown): WaitParkOn | null => {
        if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.verb !== "string") return null
        const where = entry.where === undefined ? undefined : whereOf(entry.where)
        if (where === null) return null
        const tests = Array.isArray(entry.match) ? entry.match.map((test: unknown) => matchOf(test)) : undefined
        if (tests?.includes(null)) return null
        return {
            key: entry.key,
            verb: entry.verb,
            ...(where === undefined ? {} : { where }),
            ...(tests === undefined ? {} : { match: tests.filter((test): test is WaitParkMatch => test !== null) }),
        }
    })
    return read.every((entry): entry is WaitParkOn => entry !== null) ? read : null
}

/** The members a wait compares an event and its run by: the contact, the conversation and every member its verbs declare a subject by. */
const subjectMembersOf = (on: ReadonlyArray<WaitParkOn>): ReadonlyArray<string> => [
    ...new Set([...CORE_SUBJECT_MEMBERS, ...on.flatMap((entry) => triggerSpecOf(entry.verb)?.subject ?? [])]),
]

/** The run's subject members a wait keeps: each subject member its trigger holds as non-empty text. */
export const runSubjectOf = (on: ReadonlyArray<WaitParkOn>, trigger: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> =>
    Object.fromEntries(
        subjectMembersOf(on).flatMap((member) => {
            const value = trigger[member]
            return typeof value === "string" && value !== "" ? [[member, value]] : []
        }),
    )

/** The park of a wait. */
export const waitParkOf = (
    parkKey: string,
    dueAt: string,
    on: ReadonlyArray<WaitParkOn>,
    subject: Readonly<Record<string, string>>,
): WaitPark => ({ kind: WAIT_PARK_KIND, parkKey, dueAt, on, subject })

/** The park a stopped thread's question is, or null for any other question. */
export const parkOfWaitQuestion = (question: unknown): WaitPark | null => {
    if (!isRecord(question) || question.kind !== WAIT_PARK_KIND) return null
    const { parkKey, dueAt, subject } = question
    const on = waitOnOf(question.on)
    if (typeof parkKey !== "string" || typeof dueAt !== "string" || on === null || !isRecord(subject)) return null
    const members = Object.entries(subject).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    return waitParkOf(parkKey, dueAt, on, Object.fromEntries(members))
}

/** The separator of a test member's path into the event's records (`data.content`). */
const MEMBER_PATH_SEPARATOR = "."

/**
 * The value a test member names on an event: a plain member, or the path's keys one record after the other (`data.content`,
 * `data.data.kind`), by the same rule as a trigger's `where` (the SDK's condition params); undefined where a step is no record or holds
 * no such key (never read through the prototype). A pipeline event keeps what its provider gave under `data`, so a test reads it there.
 */
export const eventMemberOf = (event: Readonly<Record<string, unknown>>, member: string): unknown => {
    const [head = "", ...keys] = member.split(MEMBER_PATH_SEPARATOR)
    let value: unknown = Object.hasOwn(event, head) ? event[head] : undefined
    for (const key of keys) {
        if (!isRecord(value) || !Object.hasOwn(value, key)) return undefined
        value = value[key]
    }
    return value
}

/** Whether one test holds of the event: its member (a path) equals (or contains) the value, by the SDK's comparison. */
const matchHolds = (test: WaitParkMatch, event: Readonly<Record<string, unknown>>): boolean =>
    compareTruth(test.op, jsonOf(eventMemberOf(event, test.member) ?? null), test.value, test.caseFold === true) === true

/** Whether the event is about the run's subject: the same non-empty value of one member both name. */
const sameSubject = (park: WaitPark, event: Readonly<Record<string, unknown>>): boolean =>
    Object.entries(park.subject).some(([member, value]) => event[member] === value)

/**
 * The key of the trigger a parked wait takes an event of `verb` as, or null: its verb is listed, it meets that trigger's `where`, and it
 * is the run's (every `match` test holds; with none, it is about the run's subject). The first trigger in written order that takes it.
 */
export const waitTakes = (park: WaitPark, verb: string, event: Readonly<Record<string, unknown>>): string | null => {
    const taking = park.on.find(
        (entry) =>
            entry.verb === verb &&
            conditionsHold(entry.where, event) &&
            (entry.match === undefined || entry.match.length === 0
                ? sameSubject(park, event)
                : entry.match.every((test) => matchHolds(test, event))),
    )
    return taking?.key ?? null
}

/** An event as the wait's output carries it: its members as plain JSON. */
export const eventOf = (scope: Readonly<Record<string, unknown>>): Readonly<Record<string, JsonValue>> =>
    Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined).map(([name, value]) => [name, jsonOf(value)]))

/** The output of a wait for what came: `{ trigger: <key>, event }` or `{ trigger: "timeout" }`. */
export const waitOutputOf = (came: WaitCame): Readonly<Record<string, JsonValue>> =>
    "timeout" in came ? { [WAIT_ROUTE_MEMBER]: WAIT_TIMEOUT_ROUTE } : { [WAIT_ROUTE_MEMBER]: came.key, event: came.event }

/** What came, read back from a resume value, or null when it is not a wait's decision for that park. */
export const waitCameOf = (value: unknown, parkKey: string): WaitCame | null => {
    if (!isRecord(value) || value.kind !== WAIT_PARK_KIND || value.parkKey !== parkKey || !isRecord(value.came)) return null
    const { came } = value
    if (came.timeout === true) return { timeout: true }
    return typeof came.key === "string" && isRecord(came.event) ? { key: came.key, event: eventOf(came.event) } : null
}

/** The once-key of a park: the event key of the ONE wake that resumes it, whatever comes first. */
export const waitOnceKeyOf = (runId: string, parkKey: string): string => `thread:${runId}:wait:${parkKey}`

/** The thread-deadline payload of a wait's deadline: `stepKey` = the park key, `repeats` 0, `answered` = the wait mark. */
export interface WaitDeadlinePayload {
    /** The workspace of the run. */
    readonly workspaceId: string
    /** The run the timer belongs to. */
    readonly runId: string
    /** The park key. */
    readonly stepKey: string
    /** The round of the park (0 for a wait). */
    readonly repeats: number
    /** The park mark the drain tells a timer by. */
    readonly answered: number
}

/** The deadline payload of a park. */
export const waitPayloadOf = (ref: { readonly workspaceId: string; readonly runId: string }, park: WaitPark): WaitDeadlinePayload => ({
    workspaceId: ref.workspaceId,
    runId: ref.runId,
    stepKey: park.parkKey,
    repeats: 0,
    answered: WAIT_PARK_ANSWERED,
})

/** Whether a thread-deadline payload is a wait's deadline. */
export const isWaitPayload = (payload: Pick<WaitDeadlinePayload, "answered">): boolean => payload.answered === WAIT_PARK_ANSWERED

/** A run an event may be offered to: its id, the run that called it (its parent), when it began waiting. */
export interface WaitCandidate {
    /** The run. */
    readonly id: string
    /** The run that called it, or null. */
    readonly callerRunId: string | null
    /** When it parked on its wait (ISO), or null when not known (asked after every run that names one). */
    readonly waitSince: string | null
}

/** How many of the candidates are this one's callers, one above the other (its depth among them; a chain never loops past the set). */
const depthAmong = (candidate: WaitCandidate, byId: ReadonlyMap<string, WaitCandidate>): number => {
    let depth = 0
    const seen = new Set<string>([candidate.id])
    let parent = candidate.callerRunId === null ? undefined : byId.get(candidate.callerRunId)
    while (parent !== undefined && !seen.has(parent.id)) {
        depth += 1
        seen.add(parent.id)
        parent = parent.callerRunId === null ? undefined : byId.get(parent.callerRunId)
    }
    return depth
}

/**
 * The order an event is offered to the runs that may take it (lane concept engine-core rule 8, the final rule): a child before its
 * parent (the deeper in a call chain among them, the earlier), then the run that started waiting LAST, each run once. Ties (no wait time,
 * the same instant) go by id, newest first, so the order is the same on every read.
 */
export const waitOfferOrder = (candidates: ReadonlyArray<WaitCandidate>): ReadonlyArray<string> => {
    const byId = new Map<string, WaitCandidate>()
    for (const candidate of candidates) {
        const held = byId.get(candidate.id)
        if (held === undefined || (held.waitSince === null && candidate.waitSince !== null)) byId.set(candidate.id, candidate)
    }
    const ranked = [...byId.values()].map((candidate) => ({ candidate, depth: depthAmong(candidate, byId) }))
    return ranked
        .toSorted(
            (left, right) =>
                right.depth - left.depth ||
                (right.candidate.waitSince ?? "").localeCompare(left.candidate.waitSince ?? "") ||
                right.candidate.id.localeCompare(left.candidate.id),
        )
        .map(({ candidate }) => candidate.id)
}
